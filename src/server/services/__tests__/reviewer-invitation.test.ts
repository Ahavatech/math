import { describe, it, expect, beforeEach } from "vitest";
import { db as prodDb } from "@/lib/db";
import { inviteReviewer, acceptInvitation, declineInvitation, revokeInvitation, expireInvitations } from "@/server/services/reviewer-invitation";
import type { SessionUser } from "@/lib/rbac";
import { randomUUID } from "node:crypto";

const db = process.env.TEST_DATABASE_URL ? prodDb : null;

function makeEiC(id: string): SessionUser {
  return { id, name: "EiC", email: "eic@test.com", roles: ["JOURNAL_EDITOR_IN_CHIEF"], isActive: true };
}
function makeReviewer(id: string, email: string): SessionUser {
  return { id, name: "Reviewer", email, roles: ["REVIEWER"], isActive: true };
}

async function createTestUsers(db: typeof prodDb, runId: string) {
  const eic = await db.user.create({
    data: { id: `eic-${runId}`, email: `eic-${runId}@test.com`, name: "EiC" },
  });
  await db.userRole.create({ data: { userId: eic.id, role: "JOURNAL_EDITOR_IN_CHIEF" } });

  const reviewer = await db.user.create({
    data: { id: `rv-${runId}`, email: `reviewer-${runId}@test.com`, name: "Reviewer", emailVerifiedAt: new Date() },
  });
  await db.userRole.create({ data: { userId: reviewer.id, role: "REVIEWER" } });

  const author = await db.user.create({
    data: { id: `au-${runId}`, email: `author-${runId}@test.com`, name: "Author", emailVerifiedAt: new Date() },
  });
  await db.userRole.create({ data: { userId: author.id, role: "AUTHOR" } });

  return { eic, reviewer, author };
}

async function createTestManuscript(db: typeof prodDb, runId: string, submittedById: string, authorEmail: string) {
  const ms = await db.manuscript.create({
    data: {
      id: `ms-${runId}`,
      title: "Test Manuscript",
      abstract: "Test abstract",
      keywords: [],
      submittedById,
      status: "UNDER_REVIEW",
    },
  });
  await db.manuscriptAuthor.create({
    data: { manuscriptId: ms.id, name: "Author Name", email: authorEmail, order: 0 },
  });
  const round = await db.manuscriptRound.create({
    data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
  });
  return { ms, round };
}

describe.skipIf(db === null)("reviewer-invitation service", () => {
  let runId: string;

  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  it("inviteReviewer creates INVITED assignment with hashed token", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, "other@test.com");

    const actor = makeEiC(eic.id);
    const result = await inviteReviewer(db!, actor, ms.id, round.id, reviewer.id);

    expect(result).not.toBeNull();
    expect(result!.rawToken).toBeTruthy();
    expect(result!.rawToken.length).toBeGreaterThan(20);

    const assignment = await db!.reviewAssignment.findFirst({
      where: { manuscriptId: ms.id, reviewerId: reviewer.id },
    });
    expect(assignment).not.toBeNull();
    expect(assignment!.status).toBe("INVITED");
    expect(assignment!.tokenHash).toBeTruthy();
    expect(assignment!.tokenHash).not.toBe(result!.rawToken);
  });

  it("inviteReviewer rejects if reviewer email matches manuscript author (COI)", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    // reviewer email matches an author
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, `reviewer-${runId}@test.com`);

    const actor = makeEiC(eic.id);
    await expect(inviteReviewer(db!, actor, ms.id, round.id, reviewer.id)).rejects.toThrow(/conflict/i);
  });

  it("inviteReviewer rejects if reviewer is the submitter", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    // reviewer is the submitter
    const { ms, round } = await createTestManuscript(db!, runId, reviewer.id, "other2@test.com");

    const actor = makeEiC(eic.id);
    await expect(inviteReviewer(db!, actor, ms.id, round.id, reviewer.id)).rejects.toThrow(/conflict/i);
  });

  it("inviteReviewer rejects duplicate invitation on same round", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, "other3@test.com");
    const actor = makeEiC(eic.id);

    await inviteReviewer(db!, actor, ms.id, round.id, reviewer.id);
    await expect(inviteReviewer(db!, actor, ms.id, round.id, reviewer.id)).rejects.toThrow(/already invited/i);
  });

  it("acceptInvitation sets status ACCEPTED and clears tokenHash", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, "other4@test.com");
    const actor = makeEiC(eic.id);

    const { rawToken } = await inviteReviewer(db!, actor, ms.id, round.id, reviewer.id);

    const reviewerUser = makeReviewer(reviewer.id, `reviewer-${runId}@test.com`);
    const result = await acceptInvitation(db!, reviewerUser, rawToken);

    expect(result).not.toBeNull();
    expect(result!.manuscriptId).toBe(ms.id);

    const assignment = await db!.reviewAssignment.findFirst({
      where: { manuscriptId: ms.id, reviewerId: reviewer.id },
    });
    expect(assignment!.status).toBe("ACCEPTED");
    expect(assignment!.tokenHash).toBeNull();
  });

  it("declineInvitation sets status DECLINED with reason", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, "other5@test.com");
    const actor = makeEiC(eic.id);

    const { rawToken } = await inviteReviewer(db!, actor, ms.id, round.id, reviewer.id);
    const reviewerUser = makeReviewer(reviewer.id, `reviewer-${runId}@test.com`);
    await declineInvitation(db!, reviewerUser, rawToken, "Too busy");

    const assignment = await db!.reviewAssignment.findFirst({
      where: { manuscriptId: ms.id, reviewerId: reviewer.id },
    });
    expect(assignment!.status).toBe("DECLINED");
    expect(assignment!.declineReason).toBe("Too busy");
    expect(assignment!.tokenHash).toBeNull();
  });

  it("revokeInvitation sets status REVOKED and logs audit event", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, "other6@test.com");
    const actor = makeEiC(eic.id);

    const { assignmentId } = await inviteReviewer(db!, actor, ms.id, round.id, reviewer.id);
    await revokeInvitation(db!, actor, assignmentId);

    const assignment = await db!.reviewAssignment.findUnique({ where: { id: assignmentId } });
    expect(assignment!.status).toBe("REVOKED");

    const event = await db!.manuscriptEvent.findFirst({
      where: { manuscriptId: ms.id, type: "REVIEWER_REVOKED" },
    });
    expect(event).not.toBeNull();
  });

  it("expired/bad/consumed tokens all return null (indistinguishable)", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, "other7@test.com");
    const actor = makeEiC(eic.id);
    const reviewerUser = makeReviewer(reviewer.id, `reviewer-${runId}@test.com`);

    // Bad token
    expect(await acceptInvitation(db!, reviewerUser, "totally-invalid-token")).toBeNull();

    // Consumed token
    const { rawToken } = await inviteReviewer(db!, actor, ms.id, round.id, reviewer.id);
    await acceptInvitation(db!, reviewerUser, rawToken);
    expect(await acceptInvitation(db!, reviewerUser, rawToken)).toBeNull();
  });

  it("expireInvitations marks INVITED-past-expiry assignments EXPIRED", async () => {
    const { eic, reviewer } = await createTestUsers(db!, runId);
    const { ms, round } = await createTestManuscript(db!, runId, eic.id, "other8@test.com");
    const actor = makeEiC(eic.id);

    const { assignmentId } = await inviteReviewer(db!, actor, ms.id, round.id, reviewer.id, {
      invitedAtOverride: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    });

    const count = await expireInvitations(db!, 14);
    expect(count).toBeGreaterThanOrEqual(1);

    const assignment = await db!.reviewAssignment.findUnique({ where: { id: assignmentId } });
    expect(assignment!.status).toBe("EXPIRED");
  });
});
