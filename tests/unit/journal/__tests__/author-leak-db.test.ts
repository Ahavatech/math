/**
 * DB-backed author payload leak test (prompt step 1).
 *
 * Creates a real manuscript with 2 reviewers, accepted assignments, submitted
 * reviews with commentsToEditor, a decision, and one of every reviewer-only
 * ManuscriptEvent type. Then calls every author-facing service and asserts
 * that no payload contains reviewer ids, names, emails, tokenHash,
 * commentsToEditor, or reviewer-only event types.
 * Reviewers appear only as "Reviewer N".
 *
 * Requires TEST_DATABASE_URL (database name must end in _test).
 */

import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { getTestDb } from "../../database/test-db";
import { getAuthorManuscripts, getAuthorManuscriptDetail } from "@/server/services/author-dashboard";
import { getReviewsForAuthor } from "@/server/services/review-visibility";
import type { SessionUser } from "@/lib/rbac";

const db = await getTestDb();

if (db === null) {
  console.warn("[author-leak-db.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

const RUN = randomUUID().slice(0, 8);

const AUTHOR_ID = `al-author-${RUN}`;
const REVIEWER1_ID = `al-rv1-${RUN}`;
const REVIEWER2_ID = `al-rv2-${RUN}`;
const EDITOR_ID = `al-ed-${RUN}`;
const MS_ID = `al-ms-${RUN}`;

const REVIEWER1_EMAIL = `al-rv1-${RUN}@secret.example.com`;
const REVIEWER2_EMAIL = `al-rv2-${RUN}@secret.example.com`;
const REVIEWER1_NAME = `Secret Reviewer One ${RUN}`;
const REVIEWER2_NAME = `Secret Reviewer Two ${RUN}`;
const TOKEN_HASH = `tokenhash-${RUN}-aaabbbccc`;
const COMMENTS_TO_EDITOR = `editor-only-note-${RUN}`;

afterAll(async () => {
  if (!db) return;
  await db.$executeRawUnsafe(
    `DELETE FROM "ManuscriptEvent" WHERE "manuscriptId" = $1`, MS_ID,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "EditorialDecision" WHERE "manuscriptId" = $1`, MS_ID,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "Review" WHERE "assignmentId" IN (SELECT id FROM "ReviewAssignment" WHERE "manuscriptId" = $1)`, MS_ID,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "ReviewAssignment" WHERE "manuscriptId" = $1`, MS_ID,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "ManuscriptFile" WHERE "manuscriptId" = $1`, MS_ID,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "ManuscriptRound" WHERE "manuscriptId" = $1`, MS_ID,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "Manuscript" WHERE "id" = $1`, MS_ID,
  );
  for (const u of [AUTHOR_ID, REVIEWER1_ID, REVIEWER2_ID, EDITOR_ID]) {
    await db.$executeRawUnsafe(`DELETE FROM "UserRole" WHERE "userId" = $1`, u);
    await db.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = $1`, u);
  }
});

async function setup() {
  if (!db) return null;

  await db.user.create({ data: { id: AUTHOR_ID, email: `al-author-${RUN}@test.com`, name: "Author" } });
  await db.user.create({ data: { id: REVIEWER1_ID, email: REVIEWER1_EMAIL, name: REVIEWER1_NAME, emailVerifiedAt: new Date() } });
  await db.user.create({ data: { id: REVIEWER2_ID, email: REVIEWER2_EMAIL, name: REVIEWER2_NAME, emailVerifiedAt: new Date() } });
  await db.user.create({ data: { id: EDITOR_ID, email: `al-ed-${RUN}@test.com`, name: "Editor" } });

  const ms = await db.manuscript.create({
    data: {
      id: MS_ID,
      title: "Author Leak Test Manuscript",
      abstract: "Abstract text",
      keywords: [],
      submittedById: AUTHOR_ID,
      status: "UNDER_REVIEW",
    },
  });

  const round = await db.manuscriptRound.create({
    data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
  });

  await db.manuscriptFile.create({
    data: {
      manuscriptId: ms.id, roundId: round.id, kind: "MANUSCRIPT",
      originalName: "paper.pdf", storageKey: "test/paper.pdf",
      mimeType: "application/pdf", size: 1000, sha256: "abc",
    },
  });

  const assign1 = await db.reviewAssignment.create({
    data: {
      manuscriptId: ms.id, roundId: round.id,
      reviewerId: REVIEWER1_ID, invitedById: EDITOR_ID,
      status: "SUBMITTED", tokenHash: TOKEN_HASH,
    },
  });
  const assign2 = await db.reviewAssignment.create({
    data: {
      manuscriptId: ms.id, roundId: round.id,
      reviewerId: REVIEWER2_ID, invitedById: EDITOR_ID,
      status: "SUBMITTED", tokenHash: `${TOKEN_HASH}-2`,
    },
  });

  await db.review.create({
    data: {
      assignmentId: assign1.id, isDraft: false,
      recommendation: "MINOR_REVISION",
      commentsToAuthor: "Please fix section 2.",
      commentsToAuthorHtml: "<p>Please fix section 2.</p>",
      commentsToEditor: COMMENTS_TO_EDITOR,
      commentsToEditorHtml: `<p>${COMMENTS_TO_EDITOR}</p>`,
      submittedAt: new Date(),
    },
  });
  await db.review.create({
    data: {
      assignmentId: assign2.id, isDraft: false,
      recommendation: "ACCEPT",
      commentsToAuthor: "Excellent manuscript.",
      commentsToAuthorHtml: "<p>Excellent manuscript.</p>",
      commentsToEditor: `second-editor-note-${RUN}`,
      commentsToEditorHtml: `<p>second-editor-note-${RUN}</p>`,
      submittedAt: new Date(),
    },
  });

  await db.editorialDecision.create({
    data: {
      manuscriptId: ms.id, roundId: round.id,
      editorId: EDITOR_ID,
      decision: "MINOR_REVISION",
      letter: "Minor revisions required.",
      letterHtml: "<p>Minor revisions required.</p>",
    },
  });

  // One of every reviewer-only event (all visibleToAuthor: false)
  for (const type of [
    "REVIEWER_INVITED", "REVIEWER_ACCEPTED", "REVIEWER_DECLINED",
    "REVIEWER_REVOKED", "REVIEWER_EXPIRED", "REVIEWER_REMINDER_SENT",
    "REVIEW_SUBMITTED", "ROUND_CREATED",
  ] as const) {
    await db.manuscriptEvent.create({
      data: { manuscriptId: ms.id, type, actorId: REVIEWER1_ID, visibleToAuthor: false },
    });
  }
  // One author-visible event
  await db.manuscriptEvent.create({
    data: { manuscriptId: ms.id, type: "DECISION_RECORDED", actorId: EDITOR_ID, visibleToAuthor: true },
  });

  return ms;
}

const authorUser: SessionUser = { id: AUTHOR_ID, roles: ["AUTHOR"], isActive: true };

const FORBIDDEN_STRINGS = [
  REVIEWER1_ID, REVIEWER2_ID,
  REVIEWER1_EMAIL, REVIEWER2_EMAIL,
  REVIEWER1_NAME, REVIEWER2_NAME,
  TOKEN_HASH,
  COMMENTS_TO_EDITOR,
  "second-editor-note",
  "commentsToEditor",
  "commentsToEditorHtml",
  "tokenHash",
  "reviewerId",
  EDITOR_ID,
];

const REVIEWER_ONLY_EVENTS = [
  "REVIEWER_INVITED", "REVIEWER_ACCEPTED", "REVIEWER_DECLINED",
  "REVIEWER_REVOKED", "REVIEWER_EXPIRED", "REVIEWER_REMINDER_SENT",
  "REVIEW_SUBMITTED", "ROUND_CREATED",
];

function assertNoLeak(payload: unknown, label: string) {
  const json = JSON.stringify(payload);
  for (const forbidden of FORBIDDEN_STRINGS) {
    expect(json, `${label}: must not contain "${forbidden}"`).not.toContain(forbidden);
  }
  for (const type of REVIEWER_ONLY_EVENTS) {
    expect(json, `${label}: must not expose reviewer-only event "${type}"`).not.toContain(type);
  }
}

describe.skipIf(db === null)("author-facing services: no reviewer data leaked (DB-backed)", () => {
  it("setup: creates real rows in the test DB", async () => {
    const ms = await setup();
    expect(ms).not.toBeNull();
    expect(ms!.id).toBe(MS_ID);
  });

  it("getAuthorManuscripts: no reviewer ids, emails, names, tokens in list", async () => {
    const list = await getAuthorManuscripts(db!, AUTHOR_ID);
    expect(list.length).toBeGreaterThan(0);
    assertNoLeak(list, "getAuthorManuscripts");
  });

  it("getAuthorManuscriptDetail: events filtered to visibleToAuthor=true; no actorId, no reviewer data", async () => {
    const detail = await getAuthorManuscriptDetail(db!, AUTHOR_ID, MS_ID);
    assertNoLeak(detail, "getAuthorManuscriptDetail");
    // DECISION_RECORDED (visibleToAuthor: true) must appear
    const json = JSON.stringify(detail);
    expect(json).toContain("DECISION_RECORDED");
    // Events must not expose actorId
    for (const ev of detail.events) {
      const keys = Object.keys(ev);
      expect(keys, "event must not expose actorId").not.toContain("actorId");
    }
  });

  it("getReviewsForAuthor: exactly label/recommendation/commentsToAuthorHtml; no reviewer identity", async () => {
    const reviews = await getReviewsForAuthor(db!, authorUser, MS_ID);
    expect(reviews).toHaveLength(2);
    for (const [i, r] of reviews.entries()) {
      expect(r.label).toBe(`Reviewer ${i + 1}`);
      const keys = Object.keys(r).sort();
      expect(keys).toEqual(["commentsToAuthorHtml", "label", "recommendation"]);
    }
    assertNoLeak(reviews, "getReviewsForAuthor");
  });

  it("decision letter exposed to author does not include reviewer identity or commentsToEditor", async () => {
    // Status is UNDER_REVIEW not REJECTED, so rejectionLetter is null — but
    // we still confirm the detail payload is clean from reviewer data.
    const detail = await getAuthorManuscriptDetail(db!, AUTHOR_ID, MS_ID);
    const json = JSON.stringify(detail);
    expect(json).not.toContain(REVIEWER1_ID);
    expect(json).not.toContain(REVIEWER2_ID);
    expect(json).not.toContain(REVIEWER1_EMAIL);
    expect(json).not.toContain(COMMENTS_TO_EDITOR);
  });

  it("non-submitter author is denied manuscript detail", async () => {
    const other: SessionUser = { id: "other-user-id", roles: ["AUTHOR"], isActive: true };
    await expect(
      getAuthorManuscriptDetail(db!, "other-user-id", MS_ID),
    ).rejects.toThrow(/not found/i);
  });
});
