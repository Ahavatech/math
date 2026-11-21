import "server-only";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { logAction } from "@/server/services/audit";

/** What an author sends back with a revised manuscript. */
export const revisionSchema = z.object({
  response: z
    .string()
    .trim()
    .min(20, "Please explain how you answered the reviewers' comments (at least a sentence or two).")
    .max(20000, "The response is too long (20,000 characters at most)."),
});

export type RevisionInput = z.infer<typeof revisionSchema>;

/** The state of an author's revision, used to build the page and to check readiness. */
export async function getRevisionState(db: PrismaClient, userId: string, manuscriptId: string) {
  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { id: true, title: true, reference: true, status: true, submittedById: true, currentRound: true },
  });
  if (!ms || ms.submittedById !== userId) throw new Error("Manuscript not found");

  const round = await db.manuscriptRound.findFirst({
    where: { manuscriptId, number: ms.currentRound },
    select: {
      id: true,
      number: true,
      responseToReviewers: true,
      files: {
        select: { id: true, kind: true, originalName: true, size: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return { manuscript: ms, round };
}

/**
 * The author sends a revised manuscript back. It must be the author's own
 * manuscript, in REVISION_REQUESTED, with a revised file uploaded for the new
 * round and a written response. The manuscript then returns to peer review for
 * that round, where the editor invites reviewers again.
 */
export async function submitRevision(
  db: PrismaClient,
  userId: string,
  manuscriptId: string,
  input: RevisionInput,
): Promise<{ round: number }> {
  const parsed = revisionSchema.parse(input);

  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { submittedById: true, status: true, currentRound: true },
  });
  if (!ms || ms.submittedById !== userId) throw new Error("Manuscript not found");
  if (ms.status !== "REVISION_REQUESTED") throw new Error("A revision has not been requested for this manuscript");

  const round = await db.manuscriptRound.findFirst({
    where: { manuscriptId, number: ms.currentRound },
    select: { id: true, number: true, files: { select: { kind: true } } },
  });
  if (!round) throw new Error("Manuscript not found");
  if (!round.files.some((f) => f.kind === "REVISED")) {
    throw new Error("Upload your revised manuscript before sending the revision");
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    // Guards against two quick submissions: only one can move the status.
    const moved = await tx.manuscript.updateMany({
      where: { id: manuscriptId, status: "REVISION_REQUESTED" },
      data: { status: "UNDER_REVIEW" },
    });
    if (moved.count !== 1) throw new Error("A revision has not been requested for this manuscript");

    await tx.manuscriptRound.update({
      where: { id: round.id },
      data: { responseToReviewers: parsed.response, resubmittedAt: now, submittedAt: now },
    });
    await tx.manuscriptEvent.create({
      data: {
        manuscriptId,
        type: "RESUBMITTED",
        actorId: userId,
        visibleToAuthor: true,
        note: `Revised manuscript received (round ${round.number})`,
      },
    });
    // No title, filenames or response text in the audit log.
    await logAction(tx as unknown as PrismaClient, {
      actorId: userId,
      action: "journal.manuscript.resubmit_revision",
      entityType: "Manuscript",
      entityId: manuscriptId,
      summary: `Revision submitted for round ${round.number}`,
    });
  });

  return { round: round.number };
}
