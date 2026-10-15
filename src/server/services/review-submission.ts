import "server-only";
import type { PrismaClient, ReviewRecommendation } from "@prisma/client";
import { hasRole, type SessionUser } from "@/lib/rbac";
import { logAction } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";

export interface DraftReviewData {
  recommendation?: ReviewRecommendation;
  commentsToAuthor?: string;
  commentsToEditor?: string;
}

export interface SubmitReviewData {
  recommendation: ReviewRecommendation;
  commentsToAuthor: string;
  commentsToEditor?: string;
}

async function getAssignmentForReviewer(
  db: PrismaClient,
  user: SessionUser,
  assignmentId: string,
) {
  if (!hasRole(user, "REVIEWER")) throw new Error("Unauthorized: requires REVIEWER role");

  const assignment = await db.reviewAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, reviewerId: true, status: true, manuscriptId: true },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.reviewerId !== user.id) throw new Error("Unauthorized: not your assignment");
  if (assignment.status !== "ACCEPTED" && assignment.status !== "SUBMITTED") {
    throw new Error("Assignment is not in ACCEPTED status");
  }

  return assignment;
}

/**
 * Save a draft review. Creates the Review row if it doesn't exist yet.
 * HTML fields are sanitized on save.
 */
export async function saveDraftReview(
  db: PrismaClient,
  user: SessionUser,
  assignmentId: string,
  data: DraftReviewData,
): Promise<void> {
  const assignment = await getAssignmentForReviewer(db, user, assignmentId);

  const commentsToAuthorHtml = data.commentsToAuthor
    ? sanitizeRichText(data.commentsToAuthor)
    : undefined;
  const commentsToEditorHtml = data.commentsToEditor
    ? sanitizeRichText(data.commentsToEditor)
    : undefined;

  await db.review.upsert({
    where: { assignmentId },
    create: {
      assignmentId,
      isDraft: true,
      recommendation: data.recommendation ?? null,
      commentsToAuthor: data.commentsToAuthor ?? null,
      commentsToAuthorHtml: commentsToAuthorHtml ?? null,
      commentsToEditor: data.commentsToEditor ?? null,
      commentsToEditorHtml: commentsToEditorHtml ?? null,
    },
    update: {
      recommendation: data.recommendation ?? undefined,
      commentsToAuthor: data.commentsToAuthor ?? undefined,
      commentsToAuthorHtml: commentsToAuthorHtml ?? undefined,
      commentsToEditor: data.commentsToEditor ?? undefined,
      commentsToEditorHtml: commentsToEditorHtml ?? undefined,
    },
  });
}

/**
 * Submit a review. Locks it (isDraft=false); no edits allowed after this.
 * commentsToAuthor is required.
 */
export async function submitReview(
  db: PrismaClient,
  user: SessionUser,
  assignmentId: string,
  data: SubmitReviewData,
): Promise<void> {
  const assignment = await getAssignmentForReviewer(db, user, assignmentId);

  if (!data.commentsToAuthor?.trim()) {
    throw new Error("Comments to author are required");
  }

  // Check if already submitted
  const existing = await db.review.findUnique({
    where: { assignmentId },
    select: { isDraft: true },
  });
  if (existing && !existing.isDraft) {
    throw new Error("Review already submitted");
  }

  const commentsToAuthorHtml = sanitizeRichText(data.commentsToAuthor);
  const commentsToEditorHtml = data.commentsToEditor
    ? sanitizeRichText(data.commentsToEditor)
    : null;
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.review.upsert({
      where: { assignmentId },
      create: {
        assignmentId,
        isDraft: false,
        recommendation: data.recommendation,
        commentsToAuthor: data.commentsToAuthor,
        commentsToAuthorHtml,
        commentsToEditor: data.commentsToEditor ?? null,
        commentsToEditorHtml,
        submittedAt: now,
      },
      update: {
        isDraft: false,
        recommendation: data.recommendation,
        commentsToAuthor: data.commentsToAuthor,
        commentsToAuthorHtml,
        commentsToEditor: data.commentsToEditor ?? null,
        commentsToEditorHtml,
        submittedAt: now,
      },
    });

    await tx.reviewAssignment.update({
      where: { id: assignmentId },
      data: { status: "SUBMITTED" },
    });

    await tx.manuscriptEvent.create({
      data: {
        manuscriptId: assignment.manuscriptId,
        type: "REVIEW_SUBMITTED",
        actorId: user.id,
        visibleToAuthor: false,
      },
    });

    await logAction(tx as unknown as PrismaClient, {
      actorId: user.id,
      action: "journal.review.submitted",
      entityType: "ReviewAssignment",
      entityId: assignmentId,
      summary: "Review submitted",
    });
  });
}
