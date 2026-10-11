"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { listRevisions, getRevision } from "@/server/services/revisions";
import { createNewsPost, updateNewsPost, setNewsPostStatus } from "@/server/services/news";
import { watLocalInputToUtc } from "@/lib/time";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireNewsManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "news.manage");
}

function revalidateNewsPaths(slug?: string) {
  revalidatePath("/admin/news");
  revalidatePath("/news");
  revalidatePath("/news/rss.xml");
  revalidatePath("/");
  if (slug) revalidatePath(`/news/${slug}`);
}

const newsFormSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.enum(["ANNOUNCEMENT", "ACHIEVEMENT", "ADMISSION", "RESEARCH"]),
  excerpt: z.string().max(300).default(""),
  body: z.string(),
  coverId: z.string().nullable(),
  isPinned: z.coerce.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string().nullable(),
});

function parseNewsForm(formData: FormData) {
  const publishedAtRaw = formData.get("publishedAt");
  return newsFormSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    category: formData.get("category"),
    excerpt: formData.get("excerpt"),
    body: formData.get("body"),
    coverId: formData.get("coverId") ? String(formData.get("coverId")) : null,
    isPinned: formData.get("isPinned") === "true",
    status: formData.get("status"),
    publishedAt: publishedAtRaw ? String(publishedAtRaw) : null,
  });
}

export async function createNewsPostAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireNewsManage();
  const parsed = parseNewsForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { slug: _slug, ...rest } = parsed.data;
    const created = await createNewsPost(
      db,
      { ...rest, body: sanitizeRichText(parsed.data.body), publishedAt: parsed.data.publishedAt ? watLocalInputToUtc(parsed.data.publishedAt) : null },
      actor.id,
      contextFromHeaders(await headers()),
    );
    revalidateNewsPaths(created.slug);
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateNewsPostAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireNewsManage();
  const id = String(formData.get("id") ?? "");
  const parsed = parseNewsForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await updateNewsPost(
      db,
      id,
      {
        ...parsed.data,
        body: sanitizeRichText(parsed.data.body),
        publishedAt: parsed.data.publishedAt ? watLocalInputToUtc(parsed.data.publishedAt) : null,
      },
      actor.id,
      contextFromHeaders(await headers()),
    );
    revalidateNewsPaths(updated.slug);
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setNewsPostStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireNewsManage();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    return { error: "Invalid status" };
  }

  try {
    const updated = await setNewsPostStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidateNewsPaths(updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function listNewsRevisionsAction(id: string) {
  await requireNewsManage();
  const revisions = await listRevisions(db, "NewsPost", id);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreNewsPostAction(formData: FormData): Promise<void> {
  const actor = await requireNewsManage();
  const id = String(formData.get("id") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");

  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "NewsPost" || revision.entityId !== id) {
    throw new Error("Revision does not belong to this post");
  }

  const snapshot = revision.snapshot as Record<string, unknown>;
  const updated = await updateNewsPost(
    db,
    id,
    { ...snapshot, publishedAt: snapshot.publishedAt ? new Date(snapshot.publishedAt as string) : null } as never,
    actor.id,
    contextFromHeaders(await headers()),
  );
  revalidateNewsPaths(updated.slug);
}
