"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { db } from "@/lib/db";
import {
  createArticle,
  updateArticle,
  setArticleStatus,
  findPossibleDuplicateArticle,
  getPublishingChecklist,
} from "@/server/services/journal-articles";
import { registerArticlePdf } from "@/server/services/journal-article-pdf";

type ActionResult = { error?: string; success?: boolean; id?: string; duplicateWarning?: string };

function parseAuthors(formData: FormData) {
  const names = formData.getAll("authorName").map(String);
  const affiliations = formData.getAll("authorAffiliation").map(String);
  const orcids = formData.getAll("authorOrcid").map(String);
  const emails = formData.getAll("authorEmail").map(String);
  const userIds = formData.getAll("authorUserId").map(String);

  return names
    .map((name, i) => ({
      name,
      affiliation: affiliations[i] || undefined,
      orcid: orcids[i] || undefined,
      email: emails[i] || undefined,
      userId: userIds[i] || null,
      order: i,
    }))
    .filter((a) => a.name.trim());
}

function parseInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    abstract: String(formData.get("abstract") ?? ""),
    keywords: String(formData.get("keywords") ?? "").split(",").map((k) => k.trim()).filter(Boolean),
    authors: parseAuthors(formData),
    issueId: (formData.get("issueId") as string) || null,
    pageStart: formData.get("pageStart") ? Number(formData.get("pageStart")) : null,
    pageEnd: formData.get("pageEnd") ? Number(formData.get("pageEnd")) : null,
    type: String(formData.get("type") ?? "RESEARCH_ARTICLE"),
    doi: String(formData.get("doi") ?? ""),
    license: String(formData.get("license") ?? ""),
    receivedAt: (formData.get("receivedAt") as string) || null,
    acceptedAt: (formData.get("acceptedAt") as string) || null,
    status: String(formData.get("status") ?? "DRAFT") as "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CORRECTED" | "RETRACTED",
  };
}

function revalidateJournalPaths(slug?: string) {
  revalidatePath("/journal");
  revalidatePath("/journal/articles");
  revalidatePath("/journal/rss.xml");
  if (slug) revalidatePath(`/journal/articles/${slug}`);
}

export async function checkDuplicateArticleAction(title: string, issueId: string | null): Promise<string | null> {
  const user = await getCurrentUser();
  requirePermission(user, "journal.edit");
  const duplicate = await findPossibleDuplicateArticle(db, title, issueId);
  return duplicate ? duplicate.title : null;
}

export async function createArticleAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.edit");
  try {
    const created = await createArticle(db, parseInput(formData), actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/journal/articles");
    revalidateJournalPaths(created.slug);
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function updateArticleAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.edit");
  const id = String(formData.get("id") ?? "");
  try {
    const updated = await updateArticle(db, id, parseInput(formData), actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/journal/articles");
    revalidateJournalPaths(updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setArticleStatusAction(id: string, status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CORRECTED" | "RETRACTED"): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.edit");
  try {
    const updated = await setArticleStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/journal/articles");
    revalidateJournalPaths(updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function getPublishingChecklistAction(id: string) {
  const user = await getCurrentUser();
  requirePermission(user, "journal.edit");
  return getPublishingChecklist(db, id);
}

export async function registerArticlePdfAction(articleId: string, publicId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.edit");
  try {
    await registerArticlePdf(db, articleId, publicId, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/journal/articles");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not upload" };
  }
}
