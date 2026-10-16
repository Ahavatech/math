import { describe, it, expect, vi } from "vitest";

/**
 * Security tests for Stage 12b peer review.
 * Covers: IDOR, double-blind, token replay, HOD exclusion, COI blocks.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePrisma(overrides: Record<string, any> = {}): any {
  const tx = {
    reviewAssignment: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    manuscriptEvent: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };

  const base = {
    reviewAssignment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    review: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    manuscript: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    editorialDecision: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    manuscriptEvent: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(tx)),
  };

  for (const [model, methods] of Object.entries(overrides)) {
    (base as Record<string, unknown>)[model] = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(base as any)[model],
      ...methods,
    };
    if (model in tx) {
      (tx as Record<string, unknown>)[model] = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(tx as any)[model],
        ...methods,
      };
    }
  }

  return base as unknown as import("@prisma/client").PrismaClient;
}

function makeUser(overrides: Partial<import("@/lib/rbac").SessionUser> = {}): import("@/lib/rbac").SessionUser {
  return {
    id: "user-1",
    roles: ["REVIEWER"],
    isActive: true,
    email: "reviewer@example.com",
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// 1. IDOR: reviewer cannot access another reviewer's assignment
// ──────────────────────────────────────────────

describe("IDOR: reviewer assignment access", () => {
  it("throws Unauthorized when reviewer requests another user's assignment", async () => {
    const { getReviewAssignmentDetail } = await import(
      "@/server/services/reviewer-dashboard"
    );

    // Assignment exists but belongs to a different reviewer
    const db = makePrisma({
      reviewAssignment: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          id: "target-assignment-id",
          reviewerId: "real-owner-id",  // different from attacker
          status: "ACCEPTED",
          manuscriptId: "ms-1",
          roundId: "round-1",
          manuscript: { reference: "OAU-2026-001", files: [] },
          round: { number: 1 },
          review: null,
        }),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
    });

    const attacker = makeUser({ id: "attacker-id" });
    await expect(
      getReviewAssignmentDetail(db, attacker, "target-assignment-id")
    ).rejects.toThrow(/unauthorized|not your/i);
  });
});

// ──────────────────────────────────────────────
// 2. Double-blind: getReviewsForAuthor strips reviewer identity
// ──────────────────────────────────────────────

describe("Double-blind: author view of reviews", () => {
  it("does not expose reviewerId or commentsToEditor to author", async () => {
    const { getReviewsForAuthor } = await import(
      "@/server/services/review-visibility"
    );

    const fakeReview = {
      id: "rev-1",
      reviewerUserId: "secret-reviewer-id",
      commentsToAuthorHtml: "<p>Please revise section 2.</p>",
      commentsToEditorHtml: "<p>Author seems to know who I am.</p>",
      recommendation: "MINOR_REVISION",
      createdAt: new Date("2026-10-01T10:00:00Z"),
      isDraft: false,
    };

    const db = makePrisma({
      manuscript: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({ id: "ms-1", submittedById: "author-1" }),
      },
      reviewAssignment: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([
          { id: "assign-1", reviewerUserId: "secret-reviewer-id", status: "SUBMITTED", review: fakeReview, createdAt: new Date("2026-10-01") },
        ]),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
    });

    const author = makeUser({ id: "author-1", roles: ["AUTHOR"] });
    const results = await getReviewsForAuthor(db, author, "ms-1");

    expect(results.length).toBe(1);
    const r = results[0] as unknown as Record<string, unknown>;
    // Must not expose reviewer identity
    expect(r).not.toHaveProperty("reviewerUserId");
    expect(r).not.toHaveProperty("reviewerId");
    // Must not expose editor-only comments
    expect(r).not.toHaveProperty("commentsToEditorHtml");
    expect(r).not.toHaveProperty("commentsToEditor");
    // Must have author-visible fields
    expect(r).toHaveProperty("label");
    expect(r).toHaveProperty("commentsToAuthorHtml");
  });
});

// ──────────────────────────────────────────────
// 3. Token replay: consumed/expired token returns null
// ──────────────────────────────────────────────

describe("Token security: invitation token replay", () => {
  it("returns null for a token whose assignment is not INVITED (already consumed)", async () => {
    const { acceptInvitation } = await import(
      "@/server/services/reviewer-invitation"
    );

    const txFindUnique = vi.fn().mockResolvedValue({
      id: "assign-1",
      status: "ACCEPTED", // already consumed
      manuscriptId: "ms-1",
      roundId: "round-1",
      invitedAt: new Date(),
    });

    const db = makePrisma();
    // Override the $transaction to use a tx that returns the consumed assignment
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (fn: (tx: unknown) => unknown) =>
        fn({
          reviewAssignment: { findUnique: txFindUnique, update: vi.fn() },
          manuscriptEvent: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        })
    );

    const reviewer = makeUser({ id: "reviewer-1" });
    const result = await acceptInvitation(db, reviewer, "used-raw-token");
    expect(result).toBeNull();
  });

  it("returns null when the token hash is not found (bad or expired token)", async () => {
    const { acceptInvitation } = await import(
      "@/server/services/reviewer-invitation"
    );

    const txFindUnique = vi.fn().mockResolvedValue(null); // not found

    const db = makePrisma();
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (fn: (tx: unknown) => unknown) =>
        fn({
          reviewAssignment: { findUnique: txFindUnique, update: vi.fn() },
          manuscriptEvent: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        })
    );

    const reviewer = makeUser({ id: "reviewer-1" });
    const result = await acceptInvitation(db, reviewer, "bad-raw-token");
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// 4. HOD cannot record editorial decisions
// ──────────────────────────────────────────────

describe("HOD exclusion from editorial decisions", () => {
  it("throws when HOD attempts to record a decision", async () => {
    const { recordDecision } = await import(
      "@/server/services/editorial-decision"
    );

    const db = makePrisma({
      manuscript: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          id: "ms-1",
          submittedById: "someone-else",
          status: "UNDER_REVIEW",
          authors: [],
        }),
      },
    });

    const hod = makeUser({ id: "hod-1", roles: ["HOD"], email: "hod@oau.edu.ng" });

    await expect(
      recordDecision(db, hod, "ms-1", {
        decision: "ACCEPT",
        letterHtml: "<p>Accepted.</p>",
      })
    ).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────
// 5. COI: submitter cannot be invited as reviewer
// ──────────────────────────────────────────────

describe("Conflict of interest: submitter cannot review own manuscript", () => {
  it("throws COI error when inviting the manuscript submitter", async () => {
    const { inviteReviewer } = await import(
      "@/server/services/reviewer-invitation"
    );

    const db = makePrisma({
      manuscript: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          id: "ms-1",
          submittedById: "reviewer-who-is-submitter",
          status: "UNDER_REVIEW",
          authors: [],
        }),
      },
    });

    const editor = makeUser({ id: "editor-1", roles: ["JOURNAL_EDITOR"] });

    await expect(
      inviteReviewer(db, editor, "ms-1", "round-1", "reviewer-who-is-submitter")
    ).rejects.toThrow(/conflict|COI|interest/i);
  });
});
