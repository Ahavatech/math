import { describe, it, expect, beforeEach } from "vitest";
import { db as prodDb } from "@/lib/db";
import { saveDraftReview, submitReview } from "@/server/services/review-submission";
import { inviteReviewer, acceptInvitation } from "@/server/services/reviewer-invitation";
import { decideManuscriptFileDownload } from "@/server/services/manuscript-file-download";
import type { SessionUser } from "@/lib/rbac";
import { randomUUID } from "node:crypto";

const db = process.env.TEST_DATABASE_URL ? prodDb : null;

function makeEiC(id: string): SessionUser {
  return { id, name: "EiC", email: "eic@test.com", roles: ["JOURNAL_EDITOR_IN_CHIEF"], isActive: true };
}
function makeReviewer(id: string, email: string): SessionUser {
  return { id, name: "Reviewer", email, roles: ["REVIEWER"], isActive: true };
}

async function setupReviewScenario(db: typeof prodDb, runId: string) {
  const eic = await db.user.create({
    data: { id: `eic-rs-${runId}`, email: `eic-rs-${runId}@test.com`, name: "EiC" },
  });
  await db.userRole.create({ data: { userId: eic.id, role: "JOURNAL_EDITOR_IN_CHIEF" } });

  const reviewer = await db.user.create({
    data: { id: `rv-rs-${runId}`, email: `rv-rs-${runId}@test.com`, name: "Reviewer", emailVerifiedAt: new Date() },
  });
  await db.userRole.create({ data: { userId: reviewer.id, role: "REVIEWER" } });

  const ms = await db.manuscript.create({
    data: {
      id: `ms-rs-${runId}`,
      title: "Review Test",
      abstract: "Abstract",
      keywords: [],
      submittedById: eic.id,
      status: "UNDER_REVIEW",
    },
  });
  const round = await db.manuscriptRound.create({
    data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
  });

  // Upload a manuscript file to test file access
  const msFile = await db.manuscriptFile.create({
    data: {
      manuscriptId: ms.id,
      roundId: round.id,
      kind: "MANUSCRIPT",
      originalName: "paper.pdf",
      storageKey: "test/paper.pdf",
      mimeType: "application/pdf",
      size: 1000,
      sha256: "abc123",
    },
  });
  const titlePageFile = await db.manuscriptFile.create({
    data: {
      manuscriptId: ms.id,
      roundId: round.id,
      kind: "TITLE_PAGE",
      originalName: "title.pdf",
      storageKey: "test/title.pdf",
      mimeType: "application/pdf",
      size: 500,
      sha256: "def456",
    },
  });

  const actor = makeEiC(eic.id);
  const { rawToken, assignmentId } = await inviteReviewer(db, actor, ms.id, round.id, reviewer.id);
  const reviewerUser = makeReviewer(reviewer.id, `rv-rs-${runId}@test.com`);
  await acceptInvitation(db, reviewerUser, rawToken);

  return { eic, reviewer, ms, round, msFile, titlePageFile, assignmentId, reviewerUser };
}

describe.skipIf(db === null)("review-submission service", () => {
  let runId: string;

  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  it("saveDraftReview upserts Review with isDraft=true", async () => {
    const { assignmentId, reviewerUser } = await setupReviewScenario(db!, runId);

    await saveDraftReview(db!, reviewerUser, assignmentId, {
      commentsToAuthor: "<p>Good work</p>",
      recommendation: "ACCEPT",
    });

    const review = await db!.review.findUnique({ where: { assignmentId } });
    expect(review).not.toBeNull();
    expect(review!.isDraft).toBe(true);
    expect(review!.commentsToAuthorHtml).toBeTruthy();
  });

  it("submitReview sets isDraft=false and submittedAt", async () => {
    const { assignmentId, reviewerUser } = await setupReviewScenario(db!, runId);

    await submitReview(db!, reviewerUser, assignmentId, {
      commentsToAuthor: "<p>Very thorough research</p>",
      recommendation: "MINOR_REVISION",
    });

    const review = await db!.review.findUnique({ where: { assignmentId } });
    expect(review!.isDraft).toBe(false);
    expect(review!.submittedAt).not.toBeNull();
    expect(review!.recommendation).toBe("MINOR_REVISION");
  });

  it("submitReview rejects a second submit (already submitted)", async () => {
    const { assignmentId, reviewerUser } = await setupReviewScenario(db!, runId);

    await submitReview(db!, reviewerUser, assignmentId, {
      commentsToAuthor: "<p>Good research</p>",
      recommendation: "ACCEPT",
    });

    await expect(
      submitReview(db!, reviewerUser, assignmentId, {
        commentsToAuthor: "<p>Updated</p>",
        recommendation: "REJECT",
      }),
    ).rejects.toThrow(/already submitted/i);
  });

  it("reviewer can download MANUSCRIPT kind while ACCEPTED", async () => {
    const { msFile, reviewerUser } = await setupReviewScenario(db!, runId);

    const decision = await decideManuscriptFileDownload(reviewerUser, msFile.id, db!);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.displayFilename).toMatch(/manuscript-round/);
    }
  });

  it("reviewer cannot download TITLE_PAGE kind", async () => {
    const { titlePageFile, reviewerUser } = await setupReviewScenario(db!, runId);

    const decision = await decideManuscriptFileDownload(reviewerUser, titlePageFile.id, db!);
    expect(decision.allowed).toBe(false);
  });

  it("REVOKED assignment: reviewer cannot download any file", async () => {
    const { ms, round, msFile, reviewer } = await setupReviewScenario(db!, runId);
    const reviewerUser = makeReviewer(reviewer.id, `rv-rs-${runId}@test.com`);

    // Revoke the assignment
    await db!.reviewAssignment.updateMany({
      where: { manuscriptId: ms.id, reviewerId: reviewer.id },
      data: { status: "REVOKED" },
    });

    const decision = await decideManuscriptFileDownload(reviewerUser, msFile.id, db!);
    expect(decision.allowed).toBe(false);
  });

  it("reviewer cannot download files from a different manuscript", async () => {
    const { reviewer, reviewerUser } = await setupReviewScenario(db!, runId);

    // Create a separate manuscript the reviewer is NOT assigned to
    const otherRun = randomUUID().slice(0, 8);
    const otherMs = await db!.manuscript.create({
      data: {
        id: `ms-other-${otherRun}`,
        title: "Other Manuscript",
        abstract: "Other",
        keywords: [],
        status: "UNDER_REVIEW",
      },
    });
    const otherRound = await db!.manuscriptRound.create({
      data: { manuscriptId: otherMs.id, number: 1, submittedAt: new Date() },
    });
    const otherFile = await db!.manuscriptFile.create({
      data: {
        manuscriptId: otherMs.id,
        roundId: otherRound.id,
        kind: "MANUSCRIPT",
        originalName: "other.pdf",
        storageKey: "test/other.pdf",
        mimeType: "application/pdf",
        size: 1000,
        sha256: "xyz789",
      },
    });

    const decision = await decideManuscriptFileDownload(reviewerUser, otherFile.id, db!);
    expect(decision.allowed).toBe(false);
  });
});
