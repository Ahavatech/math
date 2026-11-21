"use server";
import { notifyRevisionReceived, notifySubmitted } from "@/server/services/journal-notifications";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db as prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import {
  createDraft,
  updateDraftStep,
  submitManuscript,
} from "@/server/services/manuscript-submission";
import { transition } from "@/server/services/manuscript-workflow";
import { submitRevision } from "@/server/services/manuscript-revision";
import { JOURNAL_AUTHOR_AGREEMENT_V1 } from "@/lib/constants";

async function requireAuthor() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fjournal%2Fsubmit");
  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/login?callbackUrl=%2Fjournal%2Fsubmit");
  }
  return user;
}

export async function createOrOpenDraftAction(): Promise<never> {
  const user = await requireAuthor();

  // Check for an existing incomplete draft
  const existing = await prisma.manuscript.findFirst({
    where: { submittedById: user.id, status: "INCOMPLETE" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  const draftId = existing?.id ?? (await createDraft(prisma, user.id)).id;
  redirect(`/journal/submit/step1?draft=${draftId}`);
}

export async function saveStep1Action(formData: FormData): Promise<never> {
  const user = await requireAuthor();
  const draftId = formData.get("draftId") as string;

  const rawKeywords = (formData.get("keywords") as string | null) ?? "";
  const keywords = rawKeywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  await updateDraftStep(prisma, user.id, draftId, 1, {
    articleType: formData.get("articleType") as string,
    title: formData.get("title") as string,
    abstract: formData.get("abstract") as string,
    keywords,
  });

  redirect(`/journal/submit/step2?draft=${draftId}`);
}

export async function saveStep2Action(formData: FormData): Promise<never> {
  const user = await requireAuthor();
  const draftId = formData.get("draftId") as string;

  // Build authors array from indexed form fields
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const m = key.match(/^authors\[(\d+)\]/);
    if (m) indices.add(parseInt(m[1]!, 10));
  }
  const correspondingIndex = parseInt(
    (formData.get("correspondingAuthorIndex") as string) ?? "0",
    10,
  );
  const authors = Array.from(indices)
    .sort((a, b) => a - b)
    .map((i) => ({
      name: formData.get(`authors[${i}][name]`) as string,
      affiliation: (formData.get(`authors[${i}][affiliation]`) as string) || undefined,
      email: (formData.get(`authors[${i}][email]`) as string) || undefined,
      isCorresponding: i === correspondingIndex,
    }));

  await updateDraftStep(prisma, user.id, draftId, 2, { authors });
  redirect(`/journal/submit/step3?draft=${draftId}`);
}

export async function saveStep3Action(formData: FormData): Promise<never> {
  const user = await requireAuthor();
  const draftId = formData.get("draftId") as string;

  const buildReviewers = (prefix: string) => {
    const ns = new Set<number>();
    for (const k of formData.keys()) {
      const m = k.match(new RegExp(`^${prefix}\\[(\\d+)\\]`));
      if (m) ns.add(parseInt(m[1]!, 10));
    }
    return Array.from(ns)
      .sort((a, b) => a - b)
      .map((i) => ({
        name: formData.get(`${prefix}[${i}][name]`) as string,
        affiliation: (formData.get(`${prefix}[${i}][affiliation]`) as string) || undefined,
        email: (formData.get(`${prefix}[${i}][email]`) as string) || undefined,
      }))
      .filter((r) => r.name);
  };

  await updateDraftStep(prisma, user.id, draftId, 3, {
    coverLetter: formData.get("coverLetter") as string,
    suggestedReviewers: buildReviewers("suggestedReviewers"),
    excludedReviewers: buildReviewers("excludedReviewers"),
    anonymisedConfirmed: formData.get("anonymisedConfirmed") === "true" ? true : undefined,
  });

  redirect(`/journal/submit/step4?draft=${draftId}`);
}

export async function saveStep4Action(formData: FormData): Promise<never> {
  const user = await requireAuthor();
  const draftId = formData.get("draftId") as string;

  await updateDraftStep(prisma, user.id, draftId, 4, {
    agreementVersion: JOURNAL_AUTHOR_AGREEMENT_V1,
    agreementAcceptedAt: new Date().toISOString(),
  });

  redirect(`/journal/submit/step5?draft=${draftId}`);
}

export async function submitDraftAction(formData: FormData): Promise<never> {
  const user = await requireAuthor();
  const draftId = formData.get("draftId") as string;

  await submitManuscript(prisma, user.id, draftId);
  // Confirm to the author and alert the editors, once the response has gone.
  after(() => notifySubmitted(prisma, draftId));
  redirect("/journal/dashboard");
}

export type RevisionActionState = { error?: string } | null;

export async function submitRevisionAction(
  _prev: RevisionActionState,
  formData: FormData,
): Promise<RevisionActionState> {
  const user = await requireAuthor();
  const manuscriptId = String(formData.get("manuscriptId") ?? "");
  try {
    await submitRevision(prisma, user.id, manuscriptId, { response: String(formData.get("response") ?? "") });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const issues = (error as unknown as { issues: Array<{ message: string }> }).issues;
      return { error: issues[0]?.message ?? "Please check the response and try again." };
    }
    const message = error instanceof Error ? error.message : "";
    // Messages written for the author in the service are safe to show; anything else is not.
    const friendly = ["Upload your revised manuscript", "A revision has not been requested"];
    return {
      error: friendly.some((f) => message.startsWith(f))
        ? message
        : "The revision could not be sent. Please try again.",
    };
  }
  after(() => notifyRevisionReceived(prisma, manuscriptId));
  redirect(`/journal/dashboard/${manuscriptId}?revised=1`);
}

/** Screening sent the manuscript back; the author has replaced the file and sends it again. */
export async function resubmitReturnedAction(formData: FormData): Promise<void> {
  const user = await requireAuthor();
  const manuscriptId = String(formData.get("manuscriptId") ?? "");
  const hasFile = await prisma.manuscriptFile.count({ where: { manuscriptId, kind: "MANUSCRIPT" } });
  if (hasFile === 0) redirect(`/journal/dashboard/${manuscriptId}/revise`);
  const result = await transition(
    prisma,
    { id: user.id, roles: user.roles, isActive: user.isActive ?? true },
    manuscriptId,
    "RESUBMIT",
  );
  if (!result.ok) redirect(`/journal/dashboard/${manuscriptId}`);
  after(() => notifySubmitted(prisma, manuscriptId));
  redirect(`/journal/dashboard/${manuscriptId}?revised=1`);
}
