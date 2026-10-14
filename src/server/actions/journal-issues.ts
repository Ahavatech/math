"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { createIssue, updateIssue, archiveIssue } from "@/server/services/journal-issues";

type ActionResult = { error?: string; success?: boolean; id?: string };

function parseInput(formData: FormData) {
  return {
    volume: Number(formData.get("volume")),
    number: Number(formData.get("number")),
    year: Number(formData.get("year")),
    title: String(formData.get("title") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    status: String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
  };
}

function revalidateJournalPaths() {
  revalidatePath("/journal");
  revalidatePath("/journal/issues");
}

export async function createIssueAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.edit");
  const coverId = (formData.get("coverId") as string) || null;
  try {
    const created = await createIssue(parseInput(formData), coverId, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/journal/issues");
    revalidateJournalPaths();
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function updateIssueAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.edit");
  const id = String(formData.get("id") ?? "");
  const coverId = (formData.get("coverId") as string) || null;
  try {
    await updateIssue(id, parseInput(formData), coverId, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/journal/issues");
    revalidateJournalPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function archiveIssueAction(id: string): Promise<void> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.edit");
  await archiveIssue(id, actor.id, contextFromHeaders(await headers()));
  revalidatePath("/admin/journal/issues");
  revalidateJournalPaths();
}
