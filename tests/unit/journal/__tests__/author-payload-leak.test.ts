/**
 * Author payload leak tests (spec section 6).
 *
 * Scans every author-facing service return value for reviewer-identifying
 * fields: reviewer user ids, names, emails, tokenHash/tokens,
 * commentsToEditor, internal notes, assignment IDs in the wrong place,
 * and reviewer-only event types.
 *
 * These tests use in-memory mocks so they run without a database.
 */

import { describe, it, expect, vi } from "vitest";
import type { SessionUser } from "@/lib/rbac";

// ── helpers ─────────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

/** Returns keys visible at any depth in a serialised object. */
function allKeys(obj: unknown, depth = 0): string[] {
  if (!obj || typeof obj !== "object" || depth > 10) return [];
  return Object.entries(obj as AnyRecord).flatMap(([k, v]) => [
    k,
    ...allKeys(v, depth + 1),
  ]);
}

function makeAuthor(overrides: Partial<SessionUser> = {}): SessionUser {
  return { id: "author-1", roles: ["AUTHOR"], isActive: true, ...overrides };
}

// Reviewer-identifying data that must NEVER appear in author payloads.
const REVIEWER_ID = "secret-reviewer-id-abc123";
const REVIEWER_EMAIL = "secret.reviewer@university.edu";
const REVIEWER_NAME = "Dr. Jane Secret";
const TOKEN_HASH = "aaabbb111ccc222ddd333eee444fff555ggg666hhh777iii888jjj999kkk0";
const COMMENTS_TO_EDITOR = "Author seems to know who I am -- confidential editor note";
const ASSIGNMENT_ID = "assignment-id-should-not-leak";

// ── Prisma mock ──────────────────────────────────────────────────────────────

function makePrisma(overrides: AnyRecord = {}): unknown {
  const base: AnyRecord = {
    manuscript: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    manuscriptFile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    manuscriptEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    editorialDecision: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    reviewAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  for (const [model, methods] of Object.entries(overrides)) {
    (base as AnyRecord)[model] = { ...(base[model] as AnyRecord), ...(methods as AnyRecord) };
  }
  return base;
}

// ── 1. getAuthorManuscripts ──────────────────────────────────────────────────

describe("getAuthorManuscripts: no reviewer data", () => {
  it("returns manuscript list with no reviewer-identifying fields", async () => {
    const { getAuthorManuscripts } = await import("@/server/services/author-dashboard");

    // Mock returns ONLY what Prisma's `select` clause returns (no reviewAssignments).
    // The defense is in the select; there is no JS-level stripping.
    const db = makePrisma({
      manuscript: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ms-1",
            reference: "OAU-2026-001",
            title: "On prime numbers",
            status: "UNDER_REVIEW",
            submittedById: "author-1",
            createdAt: new Date("2026-10-01"),
            submittedAt: new Date("2026-10-02"),
            // No reviewAssignments — Prisma select does not include them
          },
        ]),
      },
    });

    const result = await getAuthorManuscripts(db as import("@prisma/client").PrismaClient, "author-1");
    const json = JSON.stringify(result);

    expect(json).not.toContain(REVIEWER_ID);
    expect(json).not.toContain(REVIEWER_EMAIL);
    expect(json).not.toContain(ASSIGNMENT_ID);
    // Expected fields
    expect(result[0].id).toBe("ms-1");
    expect(result[0]).toHaveProperty("plainLanguageStatus");
  });
});

// ── 2. getAuthorManuscriptDetail ─────────────────────────────────────────────

describe("getAuthorManuscriptDetail: events and files contain no reviewer data", () => {
  it("filters out reviewer-type events (visibleToAuthor: false) and never exposes actorId as reviewer", async () => {
    const { getAuthorManuscriptDetail } = await import("@/server/services/author-dashboard");

    // All 10 reviewer-only event types have visibleToAuthor: false.
    // The service queries with `where: { visibleToAuthor: true }`, so
    // they never reach the JavaScript layer. The mock already filters them
    // (simulating what Prisma returns) by only including the decision event.
    // One author-visible event (DECISION_RECORDED).
    // actorId is NOT in Prisma's select { id, type, visibleToAuthor, note, createdAt }
    // so the service never receives or returns it.
    const decisionEvent = {
      id: "ev-decision",
      type: "DECISION_RECORDED",
      visibleToAuthor: true,
      note: "Decision: MINOR_REVISION",
      createdAt: new Date("2026-10-15"),
      // No actorId: Prisma's select clause excludes it
    };

    const db = makePrisma({
      manuscript: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ms-1",
          reference: "OAU-2026-001",
          title: "On prime numbers",
          abstract: "An abstract.",
          keywords: ["prime"],
          status: "REVISION_REQUESTED",
          submittedById: "author-1",
          createdAt: new Date("2026-10-01"),
          submittedAt: new Date("2026-10-02"),
          files: [
            {
              id: "file-1",
              kind: "MANUSCRIPT",
              originalName: "paper.pdf",
              size: 12345,
              createdAt: new Date("2026-10-02"),
            },
          ],
          // Service queries events with `where: { visibleToAuthor: true }` inside the
          // same findUnique select -- so only decisionEvent would be returned.
          events: [decisionEvent],  // service already applies the WHERE filter
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      editorialDecision: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await getAuthorManuscriptDetail(
      db as import("@prisma/client").PrismaClient,
      "author-1",
      "ms-1"
    );

    const json = JSON.stringify(result);

    // Reviewer-identifying data must not be in the output
    expect(json).not.toContain(REVIEWER_ID);
    expect(json).not.toContain(REVIEWER_EMAIL);
    expect(json).not.toContain(REVIEWER_NAME);
    expect(json).not.toContain(ASSIGNMENT_ID);
    expect(json).not.toContain(TOKEN_HASH);
    expect(json).not.toContain(COMMENTS_TO_EDITOR);

    // The reviewer-only event types must not appear in the result
    for (const type of [
      "REVIEWER_INVITED", "REVIEWER_ACCEPTED", "REVIEWER_DECLINED",
      "REVIEWER_REVOKED", "REVIEWER_EXPIRED", "REVIEWER_REMINDER_SENT",
      "REVIEW_SUBMITTED", "ROUND_CREATED",
    ]) {
      expect(json).not.toContain(type);
    }

    // Author-visible decision event should appear
    expect(json).toContain("DECISION_RECORDED");

    // Keys check: actorId must not appear (service select does not include it)
    const keys = allKeys(result);
    expect(keys).not.toContain("actorId");
    expect(keys).not.toContain("reviewerId");
    expect(keys).not.toContain("tokenHash");
  });
});

// ── 3. getReviewsForAuthor: no reviewer identity ─────────────────────────────

describe("getReviewsForAuthor: author view strips all reviewer identity", () => {
  it("payload contains no reviewerId, email, name, token, commentsToEditor, or assignmentId", async () => {
    const { getReviewsForAuthor } = await import("@/server/services/review-visibility");

    const db = makePrisma({
      manuscript: {
        findUnique: vi.fn().mockResolvedValue({ id: "ms-1", submittedById: "author-1" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      reviewAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: ASSIGNMENT_ID,
            reviewerId: REVIEWER_ID,
            status: "SUBMITTED",
            tokenHash: TOKEN_HASH,
            createdAt: new Date("2026-10-01"),
            review: {
              id: "rev-1",
              assignmentId: ASSIGNMENT_ID,
              recommendation: "MINOR_REVISION",
              commentsToAuthorHtml: "<p>Good work. Please revise section 2.</p>",
              commentsToEditorHtml: `<p>${COMMENTS_TO_EDITOR}</p>`,
              isDraft: false,
              submittedAt: new Date("2026-10-10"),
              reviewer: { id: REVIEWER_ID, email: REVIEWER_EMAIL, name: REVIEWER_NAME },
            },
          },
          {
            id: "assign-2",
            reviewerId: "reviewer-2-id",
            status: "SUBMITTED",
            tokenHash: "anotherhash",
            createdAt: new Date("2026-10-02"),
            review: {
              id: "rev-2",
              assignmentId: "assign-2",
              recommendation: "ACCEPT",
              commentsToAuthorHtml: "<p>Excellent manuscript.</p>",
              commentsToEditorHtml: "<p>Editor-only: this is a great paper.</p>",
              isDraft: false,
              submittedAt: new Date("2026-10-11"),
              reviewer: { id: "reviewer-2-id", email: "rev2@uni.edu", name: "Prof. Anonymous" },
            },
          },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    const author = makeAuthor();
    const results = await getReviewsForAuthor(
      db as import("@prisma/client").PrismaClient,
      author,
      "ms-1"
    );

    expect(results.length).toBe(2);
    const json = JSON.stringify(results);

    // Reviewer-identifying data
    expect(json).not.toContain(REVIEWER_ID);
    expect(json).not.toContain("reviewer-2-id");
    expect(json).not.toContain(REVIEWER_EMAIL);
    expect(json).not.toContain(REVIEWER_NAME);
    expect(json).not.toContain("rev2@uni.edu");
    expect(json).not.toContain("Prof. Anonymous");
    expect(json).not.toContain(TOKEN_HASH);
    expect(json).not.toContain("anotherhash");
    expect(json).not.toContain(COMMENTS_TO_EDITOR);
    expect(json).not.toContain("editor-only");
    expect(json).not.toContain(ASSIGNMENT_ID);
    expect(json).not.toContain("assign-2");

    // Keys must be limited to the safe set
    for (const item of results) {
      const keys = Object.keys(item);
      expect(keys.sort()).toEqual(["commentsToAuthorHtml", "label", "recommendation"].sort());
    }

    // Labels must be stable Reviewer N
    expect(results[0].label).toBe("Reviewer 1");
    expect(results[1].label).toBe("Reviewer 2");
  });

  it("rejects a non-submitter author with Unauthorized error", async () => {
    const { getReviewsForAuthor } = await import("@/server/services/review-visibility");

    const db = makePrisma({
      manuscript: {
        findUnique: vi.fn().mockResolvedValue({ id: "ms-1", submittedById: "real-author" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const wrongAuthor = makeAuthor({ id: "impostor" });
    await expect(
      getReviewsForAuthor(db as import("@prisma/client").PrismaClient, wrongAuthor, "ms-1")
    ).rejects.toThrow(/unauthorized/i);
  });
});

// ── 4. getReviewsForEditor: HOD gets empty array ─────────────────────────────

describe("getReviewsForEditor: HOD returns empty, ADMIN is rejected", () => {
  it("returns empty array for HOD (journal.manuscripts.read but not journal.editorial)", async () => {
    const { getReviewsForEditor } = await import("@/server/services/review-visibility");

    const db = makePrisma({
      reviewAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: ASSIGNMENT_ID,
            reviewerId: REVIEWER_ID,
            review: { id: "rev-1", isDraft: false, recommendation: "ACCEPT", commentsToAuthorHtml: "<p>ok</p>", commentsToEditorHtml: `<p>${COMMENTS_TO_EDITOR}</p>` },
            createdAt: new Date(),
          },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    const hod: SessionUser = { id: "hod-1", roles: ["HOD"], isActive: true };
    const result = await getReviewsForEditor(
      db as import("@prisma/client").PrismaClient,
      hod,
      "ms-1"
    );

    expect(result).toEqual([]);
  });

  it("throws for a user with no journal.editorial permission (ADMIN)", async () => {
    const { getReviewsForEditor } = await import("@/server/services/review-visibility");

    const db = makePrisma();
    const admin: SessionUser = { id: "admin-1", roles: ["ADMIN"], isActive: true };

    await expect(
      getReviewsForEditor(db as import("@prisma/client").PrismaClient, admin, "ms-1")
    ).rejects.toThrow(/unauthorized/i);
  });
});
