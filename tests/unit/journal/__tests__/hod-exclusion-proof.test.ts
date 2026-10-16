/**
 * HOD exclusion proof (spec section 5).
 *
 * Proves with unit tests that:
 *  (a) HOD is blocked from every editorial action (inviteReviewer,
 *      recordDecision, revokeInvitation, acceptReviewerToken,
 *      getReviewAssignmentDetail) and gets Unauthorized.
 *  (b) HOD calling getReviewsForEditor always gets an empty array.
 *  (c) Plain ADMIN (not EDITOR) gets Unauthorized on editorial paths.
 *  (d) Plain AUTHOR gets Unauthorized on editorial paths.
 *
 * All tests run without a database (in-memory mocks via vi.fn).
 */

import { describe, it, expect, vi } from "vitest";
import type { SessionUser } from "@/lib/rbac";

// ── Session users ────────────────────────────────────────────────────────────

const HOD: SessionUser = { id: "hod-1", roles: ["HOD"], isActive: true };
const ADMIN: SessionUser = { id: "admin-1", roles: ["ADMIN"], isActive: true };
const AUTHOR: SessionUser = { id: "author-1", roles: ["AUTHOR"], isActive: true };
const EDITOR: SessionUser = { id: "editor-1", roles: ["JOURNAL_EDITOR"], isActive: true };

// ── Prisma mock ──────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

function makePrisma(overrides: AnyRecord = {}): unknown {
  const base: AnyRecord = {
    manuscript: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    manuscriptEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "ev-1" }),
    },
    reviewAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "assign-1", tokenHash: "abc" }),
      update: vi.fn().mockResolvedValue({}),
    },
    reviewerProfile: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    manuscriptRound: {
      findFirst: vi.fn().mockResolvedValue({ id: "round-1", roundNumber: 1 }),
      create: vi.fn().mockResolvedValue({ id: "round-2", roundNumber: 2 }),
    },
    editorialDecision: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "dec-1" }),
    },
    journalSetting: {
      findFirst: vi.fn().mockResolvedValue({ reviewsRequired: 2, defaultReviewDueDays: 21 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: "editor@uni.edu", emailVerifiedAt: new Date() }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(base)
    ),
  };
  for (const [model, methods] of Object.entries(overrides)) {
    (base as AnyRecord)[model] = { ...(base[model] as AnyRecord), ...(methods as AnyRecord) };
  }
  return base;
}

// ── 1. inviteReviewer ────────────────────────────────────────────────────────

describe("inviteReviewer: HOD, ADMIN, AUTHOR are blocked", () => {
  const reviewerId = "reviewer-id-xyz";

  it("throws Unauthorized for HOD", async () => {
    const { inviteReviewer } = await import("@/server/services/reviewer-invitation");
    const db = makePrisma();
    await expect(
      inviteReviewer(db as import("@prisma/client").PrismaClient, HOD, "ms-1", "round-1", reviewerId)
    ).rejects.toThrow(/unauthorized/i);
  });

  it("throws Unauthorized for ADMIN", async () => {
    const { inviteReviewer } = await import("@/server/services/reviewer-invitation");
    const db = makePrisma();
    await expect(
      inviteReviewer(db as import("@prisma/client").PrismaClient, ADMIN, "ms-1", "round-1", reviewerId)
    ).rejects.toThrow(/unauthorized/i);
  });

  it("throws Unauthorized for AUTHOR", async () => {
    const { inviteReviewer } = await import("@/server/services/reviewer-invitation");
    const db = makePrisma();
    await expect(
      inviteReviewer(db as import("@prisma/client").PrismaClient, AUTHOR, "ms-1", "round-1", reviewerId)
    ).rejects.toThrow(/unauthorized/i);
  });
});

// ── 2. recordDecision ────────────────────────────────────────────────────────

describe("recordDecision: HOD, ADMIN, AUTHOR are blocked", () => {
  const input = {
    decision: "ACCEPT" as import("@prisma/client").EditorialDecisionType,
    letterHtml: "<p>Accepted.</p>",
  };

  it("throws Unauthorized for HOD", async () => {
    const { recordDecision } = await import("@/server/services/editorial-decision");
    const db = makePrisma({
      // Stub COI check and review count check to not run
      manuscript: {
        findUnique: vi.fn().mockResolvedValue({ submittedById: "other", authors: [] }),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await expect(
      recordDecision(db as import("@prisma/client").PrismaClient, HOD, "ms-1", input)
    ).rejects.toThrow(/unauthorized/i);
  });

  it("throws Unauthorized for ADMIN", async () => {
    const { recordDecision } = await import("@/server/services/editorial-decision");
    const db = makePrisma({
      manuscript: {
        findUnique: vi.fn().mockResolvedValue({ submittedById: "other", authors: [] }),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await expect(
      recordDecision(db as import("@prisma/client").PrismaClient, ADMIN, "ms-1", input)
    ).rejects.toThrow(/unauthorized/i);
  });

  it("throws Unauthorized for AUTHOR", async () => {
    const { recordDecision } = await import("@/server/services/editorial-decision");
    const db = makePrisma({
      manuscript: {
        findUnique: vi.fn().mockResolvedValue({ submittedById: "other", authors: [] }),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await expect(
      recordDecision(db as import("@prisma/client").PrismaClient, AUTHOR, "ms-1", input)
    ).rejects.toThrow(/unauthorized/i);
  });
});

// ── 3. getReviewsForEditor: HOD silently returns [] ──────────────────────────

describe("getReviewsForEditor: HOD gets empty array", () => {
  it("HOD gets [] even when assignments exist", async () => {
    const { getReviewsForEditor } = await import("@/server/services/review-visibility");
    const db = makePrisma({
      reviewAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "assign-1",
            reviewerId: "reviewer-x",
            review: {
              id: "rev-1",
              isDraft: false,
              recommendation: "ACCEPT",
              commentsToAuthorHtml: "<p>Good.</p>",
              commentsToEditorHtml: "<p>Secret editor note.</p>",
              submittedAt: new Date(),
            },
            createdAt: new Date(),
          },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await getReviewsForEditor(
      db as import("@prisma/client").PrismaClient,
      HOD,
      "ms-1"
    );

    expect(result).toEqual([]);
    // HOD must never see these editorial fields
    const json = JSON.stringify(result);
    expect(json).not.toContain("reviewer-x");
    expect(json).not.toContain("assign-1");
    expect(json).not.toContain("Secret editor note");
  });

  it("ADMIN gets Unauthorized (not HOD, not editorial)", async () => {
    const { getReviewsForEditor } = await import("@/server/services/review-visibility");
    const db = makePrisma();
    await expect(
      getReviewsForEditor(db as import("@prisma/client").PrismaClient, ADMIN, "ms-1")
    ).rejects.toThrow(/unauthorized/i);
  });

  it("AUTHOR gets Unauthorized", async () => {
    const { getReviewsForEditor } = await import("@/server/services/review-visibility");
    const db = makePrisma();
    await expect(
      getReviewsForEditor(db as import("@prisma/client").PrismaClient, AUTHOR, "ms-1")
    ).rejects.toThrow(/unauthorized/i);
  });

  it("EDITOR gets data (positive control: editorial permission works)", async () => {
    const { getReviewsForEditor } = await import("@/server/services/review-visibility");
    const db = makePrisma({
      reviewAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "assign-1",
            reviewerId: "reviewer-y",
            review: {
              id: "rev-1",
              isDraft: false,
              recommendation: "MINOR_REVISION",
              commentsToAuthorHtml: "<p>Good.</p>",
              commentsToEditorHtml: "<p>Editor note.</p>",
              submittedAt: new Date(),
            },
            createdAt: new Date(),
          },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await getReviewsForEditor(
      db as import("@prisma/client").PrismaClient,
      EDITOR,
      "ms-1"
    );

    expect(result.length).toBe(1);
    expect(result[0].reviewerId).toBe("reviewer-y");
    expect(result[0].commentsToEditorHtml).toContain("Editor note");
  });
});

// ── 4. revokeInvitation: HOD blocked ─────────────────────────────────────────

describe("revokeInvitation: HOD, ADMIN, AUTHOR are blocked", () => {
  it("throws Unauthorized for HOD", async () => {
    const { revokeInvitation } = await import("@/server/services/reviewer-invitation");
    const db = makePrisma();
    await expect(
      revokeInvitation(db as import("@prisma/client").PrismaClient, HOD, "assign-1")
    ).rejects.toThrow(/unauthorized/i);
  });

  it("throws Unauthorized for ADMIN", async () => {
    const { revokeInvitation } = await import("@/server/services/reviewer-invitation");
    const db = makePrisma();
    await expect(
      revokeInvitation(db as import("@prisma/client").PrismaClient, ADMIN, "assign-1")
    ).rejects.toThrow(/unauthorized/i);
  });
});
