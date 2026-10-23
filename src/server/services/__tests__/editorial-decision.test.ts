import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { recordDecision } from "@/server/services/editorial-decision";
import { inviteReviewer, acceptInvitation } from "@/server/services/reviewer-invitation";
import { submitReview } from "@/server/services/review-submission";
import type { SessionUser } from "@/lib/rbac";
import { randomUUID } from "node:crypto";

const db = await getTestDb();

function makeEiC(id: string, email: string): SessionUser {
  return { id, name: "EiC", email, roles: ["JOURNAL_EDITOR_IN_CHIEF"], isActive: true };
}
function makeReviewer(id: string, email: string): SessionUser {
  return { id, name: "Reviewer", email, roles: ["REVIEWER"], isActive: true };
}
function makeHOD(id: string): SessionUser {
  return { id, name: "HOD", email: "hod@test.com", roles: ["HOD"], isActive: true };
}

async function setupDecisionScenario(db: NonNullable<Awaited<ReturnType<typeof getTestDb>>>, runId: string, reviewCount = 2) {
  const eic = await db.user.create({
    data: { id: `eic-d-${runId}`, email: `eic-d-${runId}@test.com`, name: "EiC" },
  });
  await db.userRole.create({ data: { userId: eic.id, role: "JOURNAL_EDITOR_IN_CHIEF" } });

  const authorUser = await db.user.create({
    data: { id: `au-d-${runId}`, email: `au-d-${runId}@test.com`, name: "Author" },
  });

  const ms = await db.manuscript.create({
    data: {
      id: `ms-d-${runId}`,
      title: "Decision Test",
      abstract: "Abstract",
      keywords: [],
      submittedById: authorUser.id,
      status: "UNDER_REVIEW",
    },
  });
  const round = await db.manuscriptRound.create({
    data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
  });

  const actor = makeEiC(eic.id, `eic-d-${runId}@test.com`);

  for (let i = 0; i < reviewCount; i++) {
    const rv = await db.user.create({
      data: { id: `rv-d-${i}-${runId}`, email: `rv-d-${i}-${runId}@test.com`, name: `R${i}`, emailVerifiedAt: new Date() },
    });
    await db.userRole.create({ data: { userId: rv.id, role: "REVIEWER" } });
    const { rawToken, assignmentId } = await inviteReviewer(db, actor, ms.id, round.id, rv.id);
    await acceptInvitation(db, makeReviewer(rv.id, `rv-d-${i}-${runId}@test.com`), rawToken);
    await submitReview(db, makeReviewer(rv.id, `rv-d-${i}-${runId}@test.com`), assignmentId, {
      recommendation: "MINOR_REVISION",
      commentsToAuthor: "<p>Comments</p>",
    });
  }

  return { ms, round, eic };
}

describe.skipIf(db === null)("editorial-decision service", () => {
  let runId: string;

  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  it("recordDecision rejects when submitted review count < reviewsRequired (default 2)", async () => {
    const { ms, eic } = await setupDecisionScenario(db!, runId, 1); // only 1 review
    const actor = makeEiC(eic.id, `eic-d-${runId}@test.com`);

    await expect(
      recordDecision(db!, actor, ms.id, {
        decision: "ACCEPT",
        letterHtml: "<p>Accepted</p>",
      }),
    ).rejects.toThrow(/minimum.*review/i);
  });

  it("EiC override with reason is audit-logged and allowed", async () => {
    const { ms, eic } = await setupDecisionScenario(db!, runId, 1); // only 1 review
    const actor = makeEiC(eic.id, `eic-d-${runId}@test.com`);

    await expect(
      recordDecision(db!, actor, ms.id, {
        decision: "ACCEPT",
        letterHtml: "<p>Accepted</p>",
        allowOverride: true,
        overrideReason: "Exceptional paper requires quick decision",
      }),
    ).resolves.not.toThrow();

    const auditLog = await db!.auditLog.findFirst({
      where: { entityId: ms.id, action: { contains: "override" } },
    });
    expect(auditLog).not.toBeNull();
  });

  it("conflicted editor cannot record decision", async () => {
    const { eic } = await setupDecisionScenario(db!, runId, 2);
    const actor = makeEiC(eic.id, `eic-d-${runId}@test.com`);

    // Create a manuscript where the EiC is the submitter (COI)
    const conflictedMs = await db!.manuscript.create({
      data: {
        id: `ms-coi-${runId}`,
        title: "COI Test",
        abstract: "Abstract",
        keywords: [],
        submittedById: eic.id, // EiC is the submitter -- COI
        status: "UNDER_REVIEW",
      },
    });

    await expect(
      recordDecision(db!, actor, conflictedMs.id, {
        decision: "ACCEPT",
        letterHtml: "<p>Accepted</p>",
        allowOverride: true,
        overrideReason: "Test",
      }),
    ).rejects.toThrow(/conflict/i);
  });

  it("decision transitions manuscript to ACCEPTED", async () => {
    const { ms, eic } = await setupDecisionScenario(db!, runId, 2);
    const actor = makeEiC(eic.id, `eic-d-${runId}@test.com`);

    await recordDecision(db!, actor, ms.id, {
      decision: "ACCEPT",
      letterHtml: "<p>Your paper is accepted</p>",
    });

    const updated = await db!.manuscript.findUnique({ where: { id: ms.id }, select: { status: true } });
    expect(updated!.status).toBe("ACCEPTED");
  });

  it("MINOR_REVISION decision creates new ManuscriptRound N+1", async () => {
    const { ms, eic } = await setupDecisionScenario(db!, runId, 2);
    const actor = makeEiC(eic.id, `eic-d-${runId}@test.com`);

    await recordDecision(db!, actor, ms.id, {
      decision: "MINOR_REVISION",
      letterHtml: "<p>Please revise</p>",
    });

    const rounds = await db!.manuscriptRound.findMany({ where: { manuscriptId: ms.id } });
    expect(rounds.length).toBe(2);
    expect(rounds.some((r) => r.number === 2)).toBe(true);

    const updated = await db!.manuscript.findUnique({ where: { id: ms.id }, select: { status: true } });
    expect(updated!.status).toBe("REVISION_REQUESTED");
  });

  it("HOD calling recordDecision is rejected", async () => {
    const { ms } = await setupDecisionScenario(db!, runId, 2);
    const hod = makeHOD(`hod-d-${runId}`);

    await expect(
      recordDecision(db!, hod, ms.id, {
        decision: "ACCEPT",
        letterHtml: "<p>Accept</p>",
      }),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("revision decision creates round N+1 and author resubmission lands in that round", async () => {
    const { returnToAuthor } = await import("@/server/services/manuscript-screening");
    const { transition } = await import("@/server/services/manuscript-workflow");

    const { ms, eic } = await setupDecisionScenario(db!, runId, 2);
    const actor = makeEiC(eic.id, `eic-d-${runId}@test.com`);

    // Create the author as a proper user for the resubmit transition
    const authorRow = await db!.manuscript.findUnique({ where: { id: ms.id }, select: { submittedById: true } });
    const authorUser = await db!.user.findUnique({ where: { id: authorRow!.submittedById! }, select: { id: true } });
    const authorSession = { id: authorUser!.id, roles: ["AUTHOR" as const], isActive: true };

    // Step 1: record MINOR_REVISION decision → should create round 2
    await recordDecision(db!, actor, ms.id, {
      decision: "MINOR_REVISION",
      letterHtml: "<p>Please revise</p>",
    });

    const roundsAfterDecision = await db!.manuscriptRound.findMany({ where: { manuscriptId: ms.id }, orderBy: { number: "asc" } });
    expect(roundsAfterDecision.length).toBe(2);
    expect(roundsAfterDecision[1].number).toBe(2);

    const msAfterDecision = await db!.manuscript.findUnique({ where: { id: ms.id }, select: { status: true, currentRound: true } });
    expect(msAfterDecision!.status).toBe("REVISION_REQUESTED");
    expect(msAfterDecision!.currentRound).toBe(2);

    // Step 2: editor returns manuscript to author (REVISION_REQUESTED → RETURNED_TO_AUTHOR)
    await returnToAuthor(db!, actor, ms.id, "Please address the reviewer comments.");

    const msAfterReturn = await db!.manuscript.findUnique({ where: { id: ms.id }, select: { status: true } });
    expect(msAfterReturn!.status).toBe("RETURNED_TO_AUTHOR");

    // Step 3: author resubmits (RETURNED_TO_AUTHOR → SCREENING) — lands in currentRound 2
    const resubmitResult = await transition(db!, authorSession, ms.id, "RESUBMIT");
    expect(resubmitResult.ok).toBe(true);
    if (resubmitResult.ok) expect(resubmitResult.newStatus).toBe("SCREENING");

    const msAfterResubmit = await db!.manuscript.findUnique({ where: { id: ms.id }, select: { status: true, currentRound: true } });
    expect(msAfterResubmit!.status).toBe("SCREENING");
    expect(msAfterResubmit!.currentRound).toBe(2);
  });
});
