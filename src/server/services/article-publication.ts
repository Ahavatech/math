import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ArticleStatus } from "@prisma/client";
import { hasRole, type SessionUser } from "@/lib/rbac";
import { logAction } from "@/server/services/audit";
import {
  sendArticleBeingPreparedEmail,
  sendArticlePublishedEmail,
} from "@/lib/email";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublicationValidationResult =
  | { valid: true }
  | { valid: false; missing: string[] };

export type PublishResult =
  | { ok: true; articleId: string }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isConflicted(actor: SessionUser, submittedById: string | null): boolean {
  return !!submittedById && submittedById === actor.id;
}

function canPublish(actor: SessionUser): boolean {
  return hasRole(actor, "JOURNAL_EDITOR_IN_CHIEF") || hasRole(actor, "SUPER_ADMIN");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Checks the minimum requirements before an article can go public.
 * Does not mutate anything.
 */
export async function validateArticleForPublication(
  db: PrismaClient,
  articleId: string,
): Promise<PublicationValidationResult> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { authors: true, pdf: true },
  });
  if (!article) return { valid: false, missing: ["Article not found"] };

  const missing: string[] = [];
  if (!article.title.trim()) missing.push("Title");
  if (!article.abstract.trim()) missing.push("Abstract");
  if (article.authors.length === 0) missing.push("At least one author");
  if (!article.pdf) missing.push("Final PDF uploaded and verified");
  if (!article.license) missing.push("Licence");

  return missing.length === 0 ? { valid: true } : { valid: false, missing };
}

// ---------------------------------------------------------------------------
// Prepare (snapshot from accepted manuscript)
// ---------------------------------------------------------------------------

/**
 * Copies accepted-manuscript metadata into an Article record in DRAFT status.
 * Called once by the editor to begin the production workflow.
 */
export async function prepareArticleFromManuscript(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
): Promise<PublishResult> {
  if (!canPublish(actor)) return { ok: false, reason: "Only EiC or SUPER_ADMIN can prepare articles for publication" };

  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { id: true, title: true, abstract: true, keywords: true, status: true, submittedById: true, createdAt: true },
  });
  if (!ms) return { ok: false, reason: "Manuscript not found" };
  if (ms.status !== "ACCEPTED") return { ok: false, reason: "Only ACCEPTED manuscripts can be prepared for publication" };
  if (isConflicted(actor, ms.submittedById)) return { ok: false, reason: "Conflict of interest: editor cannot prepare their own submission" };

  // Check if an article already exists for this manuscript
  const existing = await db.article.findFirst({ where: { manuscriptId } });
  if (existing) return { ok: false, reason: "An article record already exists for this manuscript" };

  const article = await db.$transaction(async (tx) => {
    const slug = `ms-${manuscriptId.slice(0, 8)}-${Date.now()}`;
    const created = await tx.article.create({
      data: {
        manuscriptId,
        slug,
        title: ms.title,
        abstract: ms.abstract,
        keywords: ms.keywords,
        searchText: ms.title + " " + ms.abstract + " " + ms.keywords.join(" "),
        type: "RESEARCH_ARTICLE",
        status: ArticleStatus.DRAFT,
        receivedAt: ms.createdAt,
        acceptedAt: new Date(),
      },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.article.prepare",
      entityType: "Article", entityId: created.id,
      summary: `Prepared article from manuscript ${manuscriptId}`,
    });
    return created;
  });

  // Notify the corresponding author that their paper is being prepared
  try {
    const authorUser = ms.submittedById
      ? await db.user.findUnique({ where: { id: ms.submittedById }, select: { email: true, name: true } })
      : null;
    if (authorUser?.email) {
      await sendArticleBeingPreparedEmail({
        to: authorUser.email,
        authorName: authorUser.name ?? "Author",
        title: ms.title,
      });
    }
  } catch {
    // Email failure is non-fatal
  }

  return { ok: true, articleId: article.id };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function scheduleArticle(
  db: PrismaClient,
  actor: SessionUser,
  articleId: string,
  scheduledFor: Date,
): Promise<PublishResult> {
  if (!canPublish(actor)) return { ok: false, reason: "Only EiC or SUPER_ADMIN can schedule articles" };

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { status: true, manuscriptId: true },
  });
  if (!article) return { ok: false, reason: "Article not found" };

  // COI via manuscript
  if (article.manuscriptId) {
    const ms = await db.manuscript.findUnique({ where: { id: article.manuscriptId }, select: { submittedById: true } });
    if (isConflicted(actor, ms?.submittedById ?? null)) return { ok: false, reason: "Conflict of interest" };
  }

  const allowed: ArticleStatus[] = [ArticleStatus.DRAFT, ArticleStatus.SCHEDULED];
  if (!allowed.includes(article.status)) return { ok: false, reason: `Cannot schedule an article with status ${article.status}` };

  const validation = await validateArticleForPublication(db, articleId);
  if (!validation.valid) return { ok: false, reason: `Validation failed: ${validation.missing.join(", ")}` };

  await db.$transaction(async (tx) => {
    await tx.article.update({ where: { id: articleId }, data: { status: ArticleStatus.SCHEDULED, scheduledFor } });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.article.schedule",
      entityType: "Article", entityId: articleId,
      summary: `Scheduled for ${scheduledFor.toISOString()}`,
    });
  });

  return { ok: true, articleId };
}

// ---------------------------------------------------------------------------
// Publish (atomic)
// ---------------------------------------------------------------------------

export async function publishArticle(
  db: PrismaClient,
  actor: SessionUser,
  articleId: string,
  opts?: { note?: string },
): Promise<PublishResult> {
  if (!canPublish(actor)) return { ok: false, reason: "Only EiC or SUPER_ADMIN can publish articles" };

  const articleBase = await db.article.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, slug: true, status: true, manuscriptId: true, pdfDownloadId: true },
  });
  if (!articleBase) return { ok: false, reason: "Article not found" };

  const articleAuthors = await db.articleAuthor.findMany({
    where: { articleId },
    orderBy: { order: "asc" },
    select: { email: true, name: true, userId: true },
  });
  const articlePdf = articleBase.pdfDownloadId
    ? await db.download.findUnique({ where: { id: articleBase.pdfDownloadId }, select: { fileUrl: true } })
    : null;

  // COI via manuscriptId
  if (articleBase.manuscriptId) {
    const ms = await db.manuscript.findUnique({ where: { id: articleBase.manuscriptId }, select: { submittedById: true } });
    if (isConflicted(actor, ms?.submittedById ?? null)) return { ok: false, reason: "Conflict of interest: editor cannot publish their own submission" };
  }

  const publishable: ArticleStatus[] = [ArticleStatus.DRAFT, ArticleStatus.SCHEDULED];
  if (!publishable.includes(articleBase.status)) return { ok: false, reason: `Cannot publish an article with status ${articleBase.status}` };

  const validation = await validateArticleForPublication(db, articleId);
  if (!validation.valid) return { ok: false, reason: `Validation failed: ${validation.missing.join(", ")}` };

  const finalPdfSha256 = computeSha256(articlePdf?.fileUrl ?? articleId);
  const publishedAt = new Date();
  const manuscriptId = articleBase.manuscriptId;

  await db.$transaction(async (tx) => {
    await tx.article.update({
      where: { id: articleId },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt,
        finalPdfSha256,
        scheduledFor: null,
      },
    });

    // Mark the manuscript as PUBLISHED via workflow event
    if (manuscriptId) {
      await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "PUBLISHED" } });
      await tx.manuscriptEvent.create({
        data: {
          manuscriptId,
          type: "PUBLISHED",
          actorId: actor.id,
          visibleToAuthor: true,
          note: opts?.note ?? null,
        },
      });
    }

    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.article.publish",
      entityType: "Article", entityId: articleId,
      summary: `Published article "${articleBase.title}"`,
    });
  });

  // Author notification emails (non-fatal)
  try {
    const recipientEmails = new Set<string>();
    for (const a of articleAuthors) {
      if (a.email) recipientEmails.add(a.email);
      if (a.userId) {
        const u = await db.user.findUnique({ where: { id: a.userId }, select: { email: true } });
        if (u?.email) recipientEmails.add(u.email);
      }
    }
    for (const email of recipientEmails) {
      await sendArticlePublishedEmail({ to: email, title: articleBase.title, slug: articleBase.slug });
    }
  } catch {
    // Email failure does not roll back publication
  }

  return { ok: true, articleId };
}

// ---------------------------------------------------------------------------
// Unpublish (revert to DRAFT — only before first publish; use correct/retract after)
// ---------------------------------------------------------------------------

export async function unpublishArticle(
  db: PrismaClient,
  actor: SessionUser,
  articleId: string,
): Promise<PublishResult> {
  if (!canPublish(actor)) return { ok: false, reason: "Only EiC or SUPER_ADMIN can unpublish articles" };

  const article = await db.article.findUnique({ where: { id: articleId }, select: { status: true, publishedAt: true } });
  if (!article) return { ok: false, reason: "Article not found" };

  // After the first publish, use correct or retract instead
  if (article.publishedAt) return { ok: false, reason: "Article has already been published. Use correct or retract instead." };
  if (article.status !== ArticleStatus.SCHEDULED) return { ok: false, reason: "Only SCHEDULED articles can be reverted to DRAFT" };

  await db.$transaction(async (tx) => {
    await tx.article.update({ where: { id: articleId }, data: { status: ArticleStatus.DRAFT, scheduledFor: null } });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.article.unpublish",
      entityType: "Article", entityId: articleId,
      summary: "Article returned to DRAFT from SCHEDULED",
    });
  });

  return { ok: true, articleId };
}

// ---------------------------------------------------------------------------
// Correct (PUBLISHED → CORRECTED)
// ---------------------------------------------------------------------------

export async function correctArticle(
  db: PrismaClient,
  actor: SessionUser,
  articleId: string,
  notice: string,
): Promise<PublishResult> {
  if (!canPublish(actor)) return { ok: false, reason: "Only EiC or SUPER_ADMIN can record corrections" };
  if (!notice.trim()) return { ok: false, reason: "Correction notice text is required" };

  const article = await db.article.findUnique({ where: { id: articleId }, select: { status: true, notices: true } });
  if (!article) return { ok: false, reason: "Article not found" };
  if (article.status !== ArticleStatus.PUBLISHED && article.status !== ArticleStatus.CORRECTED) {
    return { ok: false, reason: "Only PUBLISHED or CORRECTED articles can receive corrections" };
  }

  const existing = Array.isArray(article.notices) ? (article.notices as string[]) : [];
  const updated = [...existing, notice.trim()];

  await db.$transaction(async (tx) => {
    await tx.article.update({
      where: { id: articleId },
      data: { status: ArticleStatus.CORRECTED, notices: updated },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.article.correct",
      entityType: "Article", entityId: articleId,
      summary: "Correction notice added",
    });
  });

  return { ok: true, articleId };
}

// ---------------------------------------------------------------------------
// Retract (PUBLISHED/CORRECTED → RETRACTED; page stays visible -- Decision 76)
// ---------------------------------------------------------------------------

export async function retractArticle(
  db: PrismaClient,
  actor: SessionUser,
  articleId: string,
  reason: string,
): Promise<PublishResult> {
  if (!canPublish(actor)) return { ok: false, reason: "Only EiC or SUPER_ADMIN can retract articles" };
  if (!reason.trim()) return { ok: false, reason: "Retraction reason is required" };

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: { status: true },
  });
  if (!article) return { ok: false, reason: "Article not found" };

  const retractable: ArticleStatus[] = [ArticleStatus.PUBLISHED, ArticleStatus.CORRECTED];
  if (!retractable.includes(article.status)) return { ok: false, reason: "Only PUBLISHED or CORRECTED articles can be retracted" };

  await db.$transaction(async (tx) => {
    await tx.article.update({
      where: { id: articleId },
      data: { status: ArticleStatus.RETRACTED, retractionReason: reason.trim() },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.article.retract",
      entityType: "Article", entityId: articleId,
      summary: "Article retracted",
    });
  });

  return { ok: true, articleId };
}

// ---------------------------------------------------------------------------
// Reviewer acknowledgements
// ---------------------------------------------------------------------------

export async function listAcknowledgedReviewers(
  db: PrismaClient,
  year: number,
): Promise<{ name: string }[]> {
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year + 1}-01-01`);

  // Distinct reviewers who completed a review this year and opted in
  const assignments = await db.reviewAssignment.findMany({
    where: {
      review: {
        isDraft: false,
        submittedAt: { gte: start, lt: end },
        recommendation: { not: null },
      },
      reviewer: {
        reviewerProfile: { acknowledgementOptIn: true },
      },
    },
    select: {
      reviewerId: true,
      reviewer: { select: { name: true } },
    },
    distinct: ["reviewerId"],
  });

  return assignments.map((a) => ({
    name: a.reviewer.name ?? "Anonymous",
  }));
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function computeSha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
