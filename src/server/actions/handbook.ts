"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { listRevisions, getRevision } from "@/server/services/revisions";
import {
  createHandbookPage,
  updateHandbookPage,
  setHandbookPageStatus,
  reorderHandbookPage,
} from "@/server/services/handbook";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireStudentsManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "students.manage");
}

function revalidateHandbookPaths(slug?: string) {
  revalidatePath("/admin/handbook");
  revalidatePath("/students/handbook");
  revalidatePath("/students");
  if (slug) revalidatePath(`/students/handbook/${slug}`);
}

function parseForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    body: sanitizeRichText(String(formData.get("body") ?? "")),
    parentId: formData.get("parentId") ? String(formData.get("parentId")) : null,
    status: String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
  };
}

export async function createHandbookPageAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  try {
    const created = await createHandbookPage(db, parseForm(formData), actor.id, contextFromHeaders(await headers()));
    revalidateHandbookPaths(created.slug);
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateHandbookPageAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  try {
    const updated = await updateHandbookPage(db, id, { ...parseForm(formData), slug }, actor.id, contextFromHeaders(await headers()));
    revalidateHandbookPaths(updated.slug);
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setHandbookPageStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    return { error: "Invalid status" };
  }
  try {
    const updated = await setHandbookPageStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidateHandbookPaths(updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function reorderHandbookPageAction(formData: FormData): Promise<void> {
  await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";
  await reorderHandbookPage(db, id, direction);
  revalidateHandbookPaths();
}

export async function listHandbookRevisionsAction(id: string) {
  await requireStudentsManage();
  const revisions = await listRevisions(db, "HandbookPage", id);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreHandbookPageAction(formData: FormData): Promise<void> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");

  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "HandbookPage" || revision.entityId !== id) {
    throw new Error("Revision does not belong to this page");
  }

  const snapshot = revision.snapshot as Record<string, unknown>;
  const updated = await updateHandbookPage(db, id, snapshot as never, actor.id, contextFromHeaders(await headers()));
  revalidateHandbookPaths(updated.slug);
}
