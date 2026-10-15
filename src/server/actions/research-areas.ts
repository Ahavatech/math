"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { getSetting, setSetting } from "@/server/services/site-settings";
import { listRevisions, getRevision } from "@/server/services/revisions";
import {
  createResearchArea,
  updateResearchArea,
  setResearchAreaStatus,
  reorderResearchArea,
} from "@/server/services/research-areas";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireAcademicsManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "academics.manage");
}

function revalidateResearchPaths(slug?: string) {
  revalidatePath("/research");
  if (slug) revalidatePath(`/research/${slug}`);
  revalidatePath("/");
}

const researchAreaSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  body: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  imageId: z.string().nullable(),
});

function parseResearchAreaForm(formData: FormData) {
  return researchAreaSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    status: formData.get("status"),
    imageId: formData.get("imageId") ? String(formData.get("imageId")) : null,
  });
}

export async function createResearchAreaAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAcademicsManage();
  const parsed = parseResearchAreaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const created = await createResearchArea(
      db,
      { ...parsed.data, body: sanitizeRichText(parsed.data.body) },
      actor.id,
      contextFromHeaders(await headers()),
    );
    revalidatePath("/admin/research");
    revalidateResearchPaths(created.slug);
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateResearchAreaAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAcademicsManage();
  const id = String(formData.get("id") ?? "");
  const parsed = parseResearchAreaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await updateResearchArea(
      db,
      id,
      { ...parsed.data, body: sanitizeRichText(parsed.data.body) },
      actor.id,
      contextFromHeaders(await headers()),
    );

    const flags = await getSetting(db, "research.importFlags");
    if (flags[updated.slug]) {
      const { [updated.slug]: _removed, ...rest } = flags;
      await setSetting(db, "research.importFlags", rest, actor.id);
    }

    revalidatePath("/admin/research");
    revalidateResearchPaths(updated.slug);
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setResearchAreaStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAcademicsManage();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    return { error: "Invalid status" };
  }

  try {
    const updated = await setResearchAreaStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/research");
    revalidateResearchPaths(updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function reorderResearchAreaAction(formData: FormData): Promise<ActionResult> {
  await requireAcademicsManage();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";

  try {
    await reorderResearchArea(db, id, direction);
    revalidatePath("/admin/research");
    revalidateResearchPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not reorder" };
  }
}

export async function listResearchAreaRevisionsAction(id: string) {
  await requireAcademicsManage();
  const revisions = await listRevisions(db, "ResearchArea", id);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreResearchAreaAction(formData: FormData): Promise<void> {
  const actor = await requireAcademicsManage();
  const id = String(formData.get("id") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");

  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "ResearchArea" || revision.entityId !== id) {
    throw new Error("Revision does not belong to this research area");
  }

  const updated = await updateResearchArea(db, id, revision.snapshot, actor.id, contextFromHeaders(await headers()));
  revalidatePath("/admin/research");
  revalidateResearchPaths(updated.slug);
}
