"use server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db as prisma } from "@/lib/db";
import { hasRole } from "@/lib/rbac";
import {
  createDraft,
  updateDraftStep,
  submitManuscript,
} from "@/server/services/manuscript-submission";
import { JOURNAL_AUTHOR_AGREEMENT_V1 } from "@/lib/constants";

async function requireAuthor() {
  const session = await auth();
  if (!session?.user) redirect("/journal/login?next=/journal/submit");
  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/journal/login?next=/journal/submit");
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
  redirect("/journal/dashboard");
}
