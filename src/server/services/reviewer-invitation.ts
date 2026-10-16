import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { hasPermission, type SessionUser } from "@/lib/rbac";
import { logAction } from "@/server/services/audit";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

async function getReviewerEmail(db: PrismaClient, userId: string): Promise<string | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  });
  return u?.emailVerifiedAt ? u.email : null;
}

function checkEditorialPermission(actor: SessionUser): void {
  if (!hasPermission(actor, "journal.editorial")) {
    throw new Error("Unauthorized: requires journal.editorial permission");
  }
}

export interface InviteReviewerOpts {
  dueAt?: Date;
  note?: string;
  /** Test-only: override the invitation timestamp for expiry testing */
  invitedAtOverride?: Date;
}

export interface InviteReviewerResult {
  assignmentId: string;
  rawToken: string;
}

/**
 * Invite a reviewer to review a manuscript round.
 * Checks COI (reviewer is submitter or email-matches an author) and duplicate.
 * Returns the raw (plaintext) token once — only its sha256 hash is stored.
 */
export async function inviteReviewer(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
  roundId: string,
  reviewerUserId: string,
  opts?: InviteReviewerOpts,
): Promise<InviteReviewerResult> {
  checkEditorialPermission(actor);

  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { submittedById: true, authors: { select: { email: true } } },
  });
  if (!ms) throw new Error("Manuscript not found");

  // COI: reviewer is the submitter
  if (ms.submittedById === reviewerUserId) {
    throw new Error("Conflict of interest: reviewer is the submitter");
  }

  // COI: reviewer email matches an author email (case-insensitive)
  const reviewerEmail = await getReviewerEmail(db, reviewerUserId);
  if (reviewerEmail) {
    const emailLower = reviewerEmail.toLowerCase();
    const hasAuthorMatch = ms.authors.some(
      (a) => a.email !== null && a.email.toLowerCase() === emailLower,
    );
    if (hasAuthorMatch) {
      throw new Error("Conflict of interest: reviewer email matches a manuscript author");
    }
  }

  // Duplicate check
  const existing = await db.reviewAssignment.findFirst({
    where: { manuscriptId, roundId, reviewerId: reviewerUserId },
  });
  if (existing) {
    throw new Error("Reviewer already invited for this round");
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const invitedAt = opts?.invitedAtOverride ?? new Date();

  const assignment = await db.$transaction(async (tx) => {
    const a = await tx.reviewAssignment.create({
      data: {
        manuscriptId,
        roundId,
        reviewerId: reviewerUserId,
        invitedById: actor.id,
        tokenHash,
        status: "INVITED",
        invitedAt,
        dueAt: opts?.dueAt ?? null,
      },
    });
    await tx.manuscriptEvent.create({
      data: {
        manuscriptId,
        type: "REVIEWER_INVITED",
        actorId: actor.id,
        visibleToAuthor: false,
        note: opts?.note ?? null,
      },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id,
      action: "journal.reviewer.invited",
      entityType: "ReviewAssignment",
      entityId: a.id,
      summary: `Reviewer invited for manuscript ${manuscriptId}`,
    });
    return a;
  });

  return { assignmentId: assignment.id, rawToken };
}

/**
 * Resend an invitation: generates a new token, invalidating the previous one.
 */
export async function resendInvitation(
  db: PrismaClient,
  actor: SessionUser,
  assignmentId: string,
): Promise<{ rawToken: string }> {
  checkEditorialPermission(actor);

  const assignment = await db.reviewAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.status !== "INVITED") {
    throw new Error("Assignment not found or not in INVITED status");
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);

  await db.reviewAssignment.update({
    where: { id: assignmentId },
    data: { tokenHash, invitedAt: new Date() },
  });

  return { rawToken };
}

/**
 * Revoke an invitation (editor action).
 */
export async function revokeInvitation(
  db: PrismaClient,
  actor: SessionUser,
  assignmentId: string,
): Promise<void> {
  checkEditorialPermission(actor);

  const assignment = await db.reviewAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, manuscriptId: true, status: true },
  });
  if (!assignment) throw new Error("Assignment not found");
  if (assignment.status === "SUBMITTED") {
    throw new Error("Cannot revoke an assignment that has already been submitted");
  }

  await db.$transaction(async (tx) => {
    await tx.reviewAssignment.update({
      where: { id: assignmentId },
      data: { status: "REVOKED", tokenHash: null },
    });
    await tx.manuscriptEvent.create({
      data: {
        manuscriptId: assignment.manuscriptId,
        type: "REVIEWER_REVOKED",
        actorId: actor.id,
        visibleToAuthor: false,
      },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id,
      action: "journal.reviewer.revoked",
      entityType: "ReviewAssignment",
      entityId: assignmentId,
      summary: `Reviewer invitation revoked`,
    });
  });
}

/**
 * Accept an invitation using the raw plaintext token.
 * Returns null for any invalid/expired/used token — indistinguishable.
 */
export async function acceptInvitation(
  db: PrismaClient,
  user: SessionUser,
  rawToken: string,
): Promise<{ manuscriptId: string; roundId: string } | null> {
  const tokenHash = hashToken(rawToken);

  return db.$transaction(async (tx) => {
    const assignment = await tx.reviewAssignment.findUnique({
      where: { tokenHash },
      select: { id: true, status: true, manuscriptId: true, roundId: true, invitedAt: true },
    });

    if (!assignment || assignment.status !== "INVITED") return null;

    await tx.reviewAssignment.update({
      where: { id: assignment.id },
      data: { status: "ACCEPTED", respondedAt: new Date(), tokenHash: null },
    });
    await tx.manuscriptEvent.create({
      data: {
        manuscriptId: assignment.manuscriptId,
        type: "REVIEWER_ACCEPTED",
        actorId: user.id,
        visibleToAuthor: false,
      },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: user.id,
      action: "journal.reviewer.accepted",
      entityType: "ReviewAssignment",
      entityId: assignment.id,
      summary: "Reviewer accepted invitation",
    });

    return { manuscriptId: assignment.manuscriptId, roundId: assignment.roundId };
  });
}

/**
 * Decline an invitation using the raw plaintext token.
 * Returns null for any invalid/expired/used token — indistinguishable.
 */
export async function declineInvitation(
  db: PrismaClient,
  user: SessionUser,
  rawToken: string,
  reason?: string,
): Promise<{ manuscriptId: string } | null> {
  const tokenHash = hashToken(rawToken);

  return db.$transaction(async (tx) => {
    const assignment = await tx.reviewAssignment.findUnique({
      where: { tokenHash },
      select: { id: true, status: true, manuscriptId: true },
    });

    if (!assignment || assignment.status !== "INVITED") return null;

    await tx.reviewAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "DECLINED",
        respondedAt: new Date(),
        tokenHash: null,
        declineReason: reason ?? null,
      },
    });
    await tx.manuscriptEvent.create({
      data: {
        manuscriptId: assignment.manuscriptId,
        type: "REVIEWER_DECLINED",
        actorId: user.id,
        visibleToAuthor: false,
        note: reason ?? null,
      },
    });

    return { manuscriptId: assignment.manuscriptId };
  });
}

/**
 * Expire all INVITED assignments whose invitedAt is older than expiryDays days.
 * Returns the count of assignments expired.
 */
export async function expireInvitations(
  db: PrismaClient,
  expiryDays: number = 14,
): Promise<number> {
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  const expired = await db.reviewAssignment.findMany({
    where: { status: "INVITED", invitedAt: { lt: cutoff } },
    select: { id: true, manuscriptId: true },
  });

  if (expired.length === 0) return 0;

  await db.$transaction(async (tx) => {
    await tx.reviewAssignment.updateMany({
      where: { id: { in: expired.map((a) => a.id) } },
      data: { status: "EXPIRED", tokenHash: null },
    });
    for (const a of expired) {
      await tx.manuscriptEvent.create({
        data: {
          manuscriptId: a.manuscriptId,
          type: "REVIEWER_EXPIRED",
          actorId: null,
          visibleToAuthor: false,
        },
      });
    }
  });

  return expired.length;
}
