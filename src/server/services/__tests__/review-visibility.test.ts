import { describe, it, expect, beforeEach } from "vitest";
import { db as prodDb } from "@/lib/db";
import { getReviewsForEditor, getReviewsForAuthor } from "@/server/services/review-visibility";
import { inviteReviewer, acceptInvitation } from "@/server/services/reviewer-invitation";
import { submitReview } from "@/server/services/review-submission";
import type { SessionUser } from "@/lib/rbac";
import { randomUUID } from "node:crypto";

const db = process.env.TEST_DATABASE_URL ? prodDb : null;

function makeEiC(id: string, email: string): SessionUser {
  return { id, name: "EiC", email, roles: ["JOURNAL_EDITOR_IN_CHIEF"], isActive: true };
}
function makeReviewer(id: string, email: string): SessionUser {
  return { id, name: "Reviewer", email, roles: ["REVIEWER"], isActive: true };
}
function makeAuthor(id: string, email: string): SessionUser {
  return { id, name: "Author", email, roles: ["AUTHOR"], isActive: true };
}
function makeHOD(id: string): SessionUser {
  return { id, name: "HOD", email: "hod@test.com", roles: ["HOD"], isActive: true };
}

async function setupVisibilityScenario(db: typeof prodDb, runId: string) {
  const eic = await db.user.create({
    data: { id: `eic-v-${runId}`, email: `eic-v-${runId}@test.com`, name: "EiC" },
  });
  await db.userRole.create({ data: { userId: eic.id, role: "JOURNAL_EDITOR_IN_CHIEF" } });

  const reviewer1 = await db.user.create({
    data: { id: `rv1-v-${runId}`, email: `rv1-v-${runId}@test.com`, name: "R1", emailVerifiedAt: new Date() },
  });
  await db.userRole.create({ data: { userId: reviewer1.id, role: "REVIEWER" } });

  const reviewer2 = await db.user.create({
    data: { id: `rv2-v-${runId}`, email: `rv2-v-${runId}@test.com`, name: "R2", emailVerifiedAt: new Date() },
  });
  await db.userRole.create({ data: { userId: reviewer2.id, role: "REVIEWER" } });

  const authorUser = await db.user.create({
    data: { id: `au-v-${runId}`, email: `au-v-${runId}@test.com`, name: "Author" },
  });
  await db.userRole.create({ data: { userId: authorUser.id, role: "AUTHOR" } });

  const ms = await db.manuscript.create({
    data: {
      id: `ms-v-${runId}`,
      title: "Visibility Test",
      abstract: "Abstract",
      keywords: [],
      submittedById: authorUser.id,
      status: "UNDER_REVIEW",
    },
  });
  const round = await db.manuscriptRound.create({
    data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
  });

  const actor = makeEiC(eic.id, `eic-v-${runId}@test.com`);
  const { rawToken: t1, assignmentId: a1 } = await inviteReviewer(db, actor, ms.id, round.id, reviewer1.id);
  const { rawToken: t2, assignmentId: a2 } = await inviteReviewer(db, actor, ms.id, round.id, reviewer2.id);

  await acceptInvitation(db, makeReviewer(reviewer1.id, `rv1-v-${runId}@test.com`), t1);
  await acceptInvitation(db, makeReviewer(reviewer2.id, `rv2-v-${runId}@test.com`), t2);

  await submitReview(db, makeReviewer(reviewer1.id, `rv1-v-${runId}@test.com`), a1, {
    recommendation: "MINOR_REVISION",
    commentsToAuthor: "<p>Please revise section 2</p>",
    commentsToEditor: "<p>Editor note: methodology weak</p>",
  });
  await submitReview(db, makeReviewer(reviewer2.id, `rv2-v-${runId}@test.com`), a2, {
    recommendation: "ACCEPT",
    commentsToAuthor: "<p>Well written</p>",
    commentsToEditor: "<p>Editor note: good paper</p>",
  });

  return { ms, round, reviewer1, reviewer2, authorUser, eic };
}

describe.skipIf(db === null)("review-visibility service", () => {
  let runId: string;

  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  it("editor sees commentsToEditorHtml and reviewerId", async () => {
    const { ms, eic } = await setupVisibilityScenario(db!, runId);
    const actor = makeEiC(eic.id, `eic-v-${runId}@test.com`);

    const reviews = await getReviewsForEditor(db!, actor, ms.id);
    expect(reviews.length).toBe(2);
    expect(reviews[0].commentsToEditorHtml).toBeTruthy();
    expect(reviews[0].reviewerId).toBeTruthy();
  });

  it("author sees commentsToAuthorHtml labelled Reviewer 1, 2 -- never reviewer identity", async () => {
    const { ms, authorUser } = await setupVisibilityScenario(db!, runId);
    const author = makeAuthor(authorUser.id, `au-v-${runId}@test.com`);

    const reviews = await getReviewsForAuthor(db!, author, ms.id);
    expect(reviews.length).toBe(2);

    // Labels must be stable reviewer labels, not identities
    const labels = reviews.map((r) => r.label);
    expect(labels).toContain("Reviewer 1");
    expect(labels).toContain("Reviewer 2");

    // Author payload must not contain private fields
    const json = JSON.stringify(reviews);
    expect(json).not.toMatch(/reviewerId|commentsToEditor|tokenHash/);
  });

  it("HOD gets empty reviews array (no reviews visible)", async () => {
    const { ms } = await setupVisibilityScenario(db!, runId);
    const hod = makeHOD(`hod-v-${runId}`);

    const reviews = await getReviewsForEditor(db!, hod, ms.id);
    expect(reviews).toHaveLength(0);
  });

  it("reviewer A cannot see reviewer B's review via getReviewsForEditor", async () => {
    const { ms, reviewer1 } = await setupVisibilityScenario(db!, runId);
    const rv1 = makeReviewer(reviewer1.id, `rv1-v-${runId}@test.com`);

    await expect(getReviewsForEditor(db!, rv1, ms.id)).rejects.toThrow(/Unauthorized/i);
  });
});
