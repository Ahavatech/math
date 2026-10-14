"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { updateJournalPage, listJournalPageRevisions } from "@/server/services/journal-pages";
import { db } from "@/lib/db";

type ActionResult = { error?: string; success?: boolean };

export async function saveJournalPageAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.manage");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  const status = String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";

  if (!id || !title.trim()) {
    return { error: "Title is required" };
  }

  try {
    await updateJournalPage(id, { title, body, status }, actor.id, contextFromHeaders(await headers()));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }

  revalidatePath("/admin/journal/pages");
  revalidatePath("/journal");
  revalidatePath("/journal/about");
  revalidatePath("/journal/guidelines");
  revalidatePath("/journal/call-for-papers");
  revalidatePath("/journal/policies");
  return { success: true };
}

export async function listJournalPageRevisionsAction(pageId: string) {
  const user = await getCurrentUser();
  requirePermission(user, "journal.manage");
  const revisions = await listJournalPageRevisions(pageId);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreJournalPageAction(pageId: string, revisionId: string): Promise<void> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.manage");
  const revision = await db.contentRevision.findUniqueOrThrow({ where: { id: revisionId } });
  const snapshot = revision.snapshot as { title: string; body: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" };
  await updateJournalPage(pageId, snapshot, actor.id, contextFromHeaders(await headers()));
  revalidatePath("/admin/journal/pages");
}
