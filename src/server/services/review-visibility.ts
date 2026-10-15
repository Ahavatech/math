import "server-only";
import type { PrismaClient } from "@prisma/client";
import { hasPermission, hasRole, type SessionUser } from "@/lib/rbac";

export interface EditorReviewView {
  reviewId: string;
  assignmentId: string;
  reviewerId: string;
  recommendation: string | null;
  commentsToAuthorHtml: string | null;
  commentsToEditorHtml: string | null;
  submittedAt: Date | null;
  label: string;
}

export interface AuthorReviewView {
  label: string;
  recommendation: string | null;
  commentsToAuthorHtml: string | null;
}

/**
 * Returns submitted reviews visible to editors (editorial roles only).
 * HOD always gets an empty array.
 * Reviewers get Unauthorized.
 */
export async function getReviewsForEditor(
  db: PrismaClient,
  user: SessionUser,
  manuscriptId: string,
): Promise<EditorReviewView[]> {
  // HOD has journal.manuscripts.read but NOT journal.editorial per docs/STATE.md
  // HOD sees NO reviews -- return empty silently
  if (hasRole(user, "HOD") && !hasPermission(user, "journal.editorial")) {
    return [];
  }

  if (!hasPermission(user, "journal.editorial")) {
    throw new Error("Unauthorized: requires journal.editorial permission");
  }

  const assignments = await db.reviewAssignment.findMany({
    where: { manuscriptId },
    include: { review: true },
    orderBy: { createdAt: "asc" },
  });

  const submitted = assignments.filter((a) => a.review && !a.review.isDraft);

  return submitted.map((a, index) => ({
    reviewId: a.review!.id,
    assignmentId: a.id,
    reviewerId: a.reviewerId,
    recommendation: a.review!.recommendation ?? null,
    commentsToAuthorHtml: a.review!.commentsToAuthorHtml ?? null,
    commentsToEditorHtml: a.review!.commentsToEditorHtml ?? null,
    submittedAt: a.review!.submittedAt ?? null,
    label: `Reviewer ${index + 1}`,
  }));
}

/**
 * Returns submitted reviews for the author: labels only, no reviewer identity.
 * Requires the user to be the submitter of the manuscript.
 */
export async function getReviewsForAuthor(
  db: PrismaClient,
  user: SessionUser,
  manuscriptId: string,
): Promise<AuthorReviewView[]> {
  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { submittedById: true },
  });
  if (!ms) throw new Error("Manuscript not found");
  if (ms.submittedById !== user.id) {
    throw new Error("Unauthorized: not the manuscript submitter");
  }

  const assignments = await db.reviewAssignment.findMany({
    where: { manuscriptId },
    include: { review: true },
    orderBy: { createdAt: "asc" },
  });

  const submitted = assignments.filter((a) => a.review && !a.review.isDraft);

  // Return ONLY fields safe for author: label, recommendation, commentsToAuthorHtml
  return submitted.map((a, index) => ({
    label: `Reviewer ${index + 1}`,
    recommendation: a.review!.recommendation ?? null,
    commentsToAuthorHtml: a.review!.commentsToAuthorHtml ?? null,
  }));
}
