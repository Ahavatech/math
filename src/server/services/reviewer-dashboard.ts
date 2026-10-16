import "server-only";
import type { PrismaClient } from "@prisma/client";
import { hasRole, type SessionUser } from "@/lib/rbac";

export interface ReviewAssignmentSummary {
  id: string;
  manuscriptId: string;
  reference: string;
  status: string;
  dueAt: Date | null;
  submittedAt: Date | null;
  roundNumber: number;
  hasDraft: boolean;
}

export async function getReviewerAssignments(
  db: PrismaClient,
  user: SessionUser,
): Promise<ReviewAssignmentSummary[]> {
  if (!hasRole(user, "REVIEWER")) {
    throw new Error("Unauthorized: requires REVIEWER role");
  }

  const assignments = await db.reviewAssignment.findMany({
    where: {
      reviewerId: user.id,
      status: { in: ["ACCEPTED", "SUBMITTED"] },
    },
    include: {
      manuscript: { select: { reference: true } },
      round: { select: { number: true } },
      review: { select: { isDraft: true, submittedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments.map((a) => ({
    id: a.id,
    manuscriptId: a.manuscriptId,
    reference: a.manuscript.reference ?? a.manuscriptId,
    status: a.status,
    dueAt: a.dueAt ?? null,
    submittedAt: a.review?.submittedAt ?? null,
    roundNumber: a.round?.number ?? 1,
    hasDraft: a.review?.isDraft === true,
  }));
}

export async function getReviewAssignmentDetail(
  db: PrismaClient,
  user: SessionUser,
  assignmentId: string,
) {
  if (!hasRole(user, "REVIEWER")) {
    throw new Error("Unauthorized: requires REVIEWER role");
  }

  const assignment = await db.reviewAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      manuscript: {
        select: {
          reference: true,
          files: {
            where: { kind: { not: "TITLE_PAGE" } },
            select: { id: true, kind: true, originalName: true, roundId: true },
          },
        },
      },
      round: { select: { number: true } },
      review: {
        select: {
          isDraft: true,
          recommendation: true,
          commentsToAuthor: true,
          commentsToEditor: true,
          submittedAt: true,
        },
      },
    },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.reviewerId !== user.id) throw new Error("Unauthorized: not your assignment");
  if (assignment.status !== "ACCEPTED" && assignment.status !== "SUBMITTED") {
    throw new Error("Assignment is not accessible");
  }

  return assignment;
}
