import "server-only";
import type { EditorialDecisionType, PrismaClient } from "@prisma/client";
import { hasPermission, hasRole, type SessionUser } from "@/lib/rbac";
import { logAction } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { getSetting } from "@/server/services/site-settings";

export interface RecordDecisionInput {
  decision: EditorialDecisionType;
  letterHtml: string;
  allowOverride?: boolean;
  overrideReason?: string;
}

async function checkCOI(
  db: PrismaClient,
  userId: string,
  manuscriptId: string,
): Promise<boolean> {
  const userRecord = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  });
  const verifiedEmail = userRecord?.emailVerifiedAt ? userRecord.email : null;

  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { submittedById: true, authors: { select: { email: true } } },
  });
  if (!ms) return false;

  if (ms.submittedById === userId) return true;
  if (verifiedEmail) {
    const emailLower = verifiedEmail.toLowerCase();
    if (ms.authors.some((a) => a.email && a.email.toLowerCase() === emailLower)) return true;
  }
  return false;
}

/**
 * Record an editorial decision (ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT).
 * Requires journal.editorial, no COI, and minimum submitted reviews.
 * On MINOR_REVISION or MAJOR_REVISION: creates a new ManuscriptRound and sets
 * status to REVISION_REQUESTED.
 * On ACCEPT: sets status to ACCEPTED.
 * On REJECT: sets status to REJECTED.
 */
export async function recordDecision(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
  input: RecordDecisionInput,
): Promise<void> {
  if (!hasPermission(actor, "journal.editorial")) {
    throw new Error("Unauthorized: requires journal.editorial permission");
  }

  // HOD also has no access (belt-and-suspenders)
  if (hasRole(actor, "HOD") && !hasRole(actor, "JOURNAL_EDITOR_IN_CHIEF") && !hasRole(actor, "SUPER_ADMIN")) {
    throw new Error("Unauthorized");
  }

  // COI check
  const conflicted = await checkCOI(db, actor.id, manuscriptId);
  if (conflicted) {
    throw new Error("Conflict of interest: cannot record decision on this manuscript");
  }

  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { status: true, currentRound: true },
  });
  if (!ms) throw new Error("Manuscript not found");

  // Get current round
  const currentRound = await db.manuscriptRound.findFirst({
    where: { manuscriptId },
    orderBy: { number: "desc" },
    select: { id: true, number: true },
  });
  if (!currentRound) throw new Error("No round found for manuscript");

  // Check reviewsRequired
  const settings = await getSetting(db, "journal.settings");
  const reviewsRequired = settings.reviewsRequired ?? 2;

  const submittedReviewCount = await db.review.count({
    where: {
      assignment: { manuscriptId, roundId: currentRound.id },
      isDraft: false,
    },
  });

  if (submittedReviewCount < reviewsRequired) {
    if (!input.allowOverride || !input.overrideReason?.trim()) {
      throw new Error(
        `Minimum ${reviewsRequired} reviews required before a decision can be recorded. ` +
        `Currently ${submittedReviewCount} submitted.`,
      );
    }

    // Log the override
    await logAction(db, {
      actorId: actor.id,
      action: "journal.decision.review_count_override",
      entityType: "Manuscript",
      entityId: manuscriptId,
      summary: `Decision recorded with override: ${submittedReviewCount}/${reviewsRequired} reviews. Reason: ${input.overrideReason}`,
    });
  }

  const letterHtml = sanitizeRichText(input.letterHtml);
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.editorialDecision.create({
      data: {
        manuscriptId,
        roundId: currentRound.id,
        editorId: actor.id,
        decision: input.decision,
        letter: null,
        letterHtml,
        decidedAt: now,
      },
    });

    let newStatus: string;
    let eventType: "DECISION_RECORDED" | "REVISION_REQUESTED" = "DECISION_RECORDED";

    if (input.decision === "MINOR_REVISION" || input.decision === "MAJOR_REVISION") {
      newStatus = "REVISION_REQUESTED";
      eventType = "REVISION_REQUESTED";

      // Create next round
      const nextNumber = currentRound.number + 1;
      await tx.manuscriptRound.create({
        data: {
          manuscriptId,
          number: nextNumber,
          submittedAt: now,
        },
      });
      await tx.manuscript.update({
        where: { id: manuscriptId },
        data: { status: "REVISION_REQUESTED", currentRound: nextNumber },
      });
      await tx.manuscriptEvent.create({
        data: {
          manuscriptId,
          type: "ROUND_CREATED",
          actorId: actor.id,
          visibleToAuthor: false,
          note: `Round ${nextNumber} created`,
        },
      });
    } else if (input.decision === "ACCEPT") {
      newStatus = "ACCEPTED";
      await tx.manuscript.update({
        where: { id: manuscriptId },
        data: { status: "ACCEPTED" },
      });
    } else {
      // REJECT or DESK_REJECT
      newStatus = "REJECTED";
      await tx.manuscript.update({
        where: { id: manuscriptId },
        data: { status: "REJECTED" },
      });
    }

    await tx.manuscriptEvent.create({
      data: {
        manuscriptId,
        type: eventType,
        actorId: actor.id,
        visibleToAuthor: true,
        note: `Decision: ${input.decision}`,
      },
    });

    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id,
      action: "journal.decision.recorded",
      entityType: "Manuscript",
      entityId: manuscriptId,
      summary: `Decision recorded: ${input.decision}`,
    });
  });
}
