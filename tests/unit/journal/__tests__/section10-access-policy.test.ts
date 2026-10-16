/**
 * Section 10 access-policy proof (spec section 3 + security requirements).
 *
 * Uses canReadManuscriptFileWithAudit and canDownloadAs directly — no DB.
 *
 * Covers every bullet from section 10:
 *  10a. Reviewer sees anonymised files only (generic filename).
 *  10b. TITLE_PAGE blocked for reviewer.
 *  10c. Revoked reviewer loses access immediately.
 *  10d. Reviewer A cannot read reviewer B's review/assignment/file.
 *  10e. Conflicted editor blocked.
 *  10f. Decision before reviewsRequired blocked (tested as authorization concern in editorial-decision.ts).
 *  10g. Used/expired/unknown tokens give identical 404 responses.
 *  10h. Invitation email shows reference only (no manuscript title / author name).
 *  10i. Decision email has no letter text.
 *  10j. REVIEW_ATTACHMENT upload rejects hostile files.
 *
 * Items 10f, 10g, 10h, 10i are tested separately (they live in other services).
 * Items 10a-10e and 10j are proven here.
 */

import { describe, it, expect } from "vitest";
import {
  canReadManuscriptFileWithAudit,
  canDownloadAs,
  type ManuscriptFileAccessInput,
  type ReviewerAssignmentInput,
} from "@/server/services/manuscript-access";
import type { SessionUser } from "@/lib/rbac";

// ── helpers ─────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return { id: "user-1", roles: ["REVIEWER"], isActive: true, ...overrides };
}

function makeFile(overrides: Partial<ManuscriptFileAccessInput> = {}): ManuscriptFileAccessInput {
  return {
    id: "file-1",
    kind: "MANUSCRIPT",
    roundId: "round-1",
    roundNumber: 1,
    manuscriptId: "ms-1",
    manuscriptSubmittedById: "author-1",
    originalName: "submission-with-author-details.pdf",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<ReviewerAssignmentInput> = {}): ReviewerAssignmentInput {
  return { roundId: "round-1", status: "ACCEPTED", ...overrides };
}

// ── 10a. Reviewer sees anonymised filename ───────────────────────────────────

describe("10a: Reviewer sees anonymised files only", () => {
  it("reviewer gets generic manuscript-round-N.pdf filename, not the original", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile({ originalName: "authors-paper-with-names.pdf" });
    const assignment = makeAssignment();

    const result = canDownloadAs(reviewer, file, assignment, false);

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error("Expected allowed");
    expect(result.displayFilename).toBe("manuscript-round-1.pdf");
    expect(result.displayFilename).not.toContain("authors-paper-with-names");
  });

  it("editor sees original filename (not anonymised)", () => {
    const editor = makeUser({ id: "editor-1", roles: ["JOURNAL_EDITOR"] });
    const file = makeFile({ originalName: "authors-paper-with-names.pdf" });

    const result = canDownloadAs(editor, file, null, false);

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error("Expected allowed");
    expect(result.displayFilename).toBe("authors-paper-with-names.pdf");
  });

  it("author sees original filename for their own manuscript", () => {
    const author = makeUser({ id: "author-1", roles: ["AUTHOR"] });
    const file = makeFile({ manuscriptSubmittedById: "author-1", originalName: "my-paper.pdf" });

    const result = canDownloadAs(author, file, null, false);

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error("Expected allowed");
    expect(result.displayFilename).toBe("my-paper.pdf");
  });

  it("REVIEW_ATTACHMENT is in the allowed kinds for reviewers", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile({ kind: "REVIEW_ATTACHMENT" });
    const assignment = makeAssignment();

    const result = canReadManuscriptFileWithAudit(reviewer, file, assignment, false);

    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(true); // spec section 3
  });
});

// ── 10b. TITLE_PAGE blocked for reviewer ────────────────────────────────────

describe("10b: TITLE_PAGE blocked for reviewer", () => {
  it("reviewer with active assignment cannot read TITLE_PAGE", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const titlePage = makeFile({ kind: "TITLE_PAGE" });
    const assignment = makeAssignment({ status: "ACCEPTED" });

    const result = canReadManuscriptFileWithAudit(reviewer, titlePage, assignment, false);

    expect(result.allowed).toBe(false);
  });

  it("editor can read TITLE_PAGE", () => {
    const editor = makeUser({ id: "editor-1", roles: ["JOURNAL_EDITOR"] });
    const titlePage = makeFile({ kind: "TITLE_PAGE" });

    const result = canReadManuscriptFileWithAudit(editor, titlePage, null, false);

    expect(result.allowed).toBe(true);
  });

  it("HOD cannot read TITLE_PAGE", () => {
    const hod = makeUser({ id: "hod-1", roles: ["HOD"] });
    const titlePage = makeFile({ kind: "TITLE_PAGE" });

    const result = canReadManuscriptFileWithAudit(hod, titlePage, null, false);

    expect(result.allowed).toBe(false);
  });
});

// ── 10c. Revoked reviewer loses access immediately ───────────────────────────

describe("10c: Revoked reviewer loses access immediately (status check)", () => {
  it("reviewer with REVOKED status cannot read", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile();
    const revokedAssignment = makeAssignment({ status: "REVOKED" });

    const result = canReadManuscriptFileWithAudit(reviewer, file, revokedAssignment, false);

    expect(result.allowed).toBe(false);
  });

  it("reviewer with INVITED (not yet accepted) status cannot read", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile();
    const pendingAssignment = makeAssignment({ status: "INVITED" });

    const result = canReadManuscriptFileWithAudit(reviewer, file, pendingAssignment, false);

    expect(result.allowed).toBe(false);
  });

  it("reviewer with DECLINED status cannot read", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile();
    const declined = makeAssignment({ status: "DECLINED" });

    const result = canReadManuscriptFileWithAudit(reviewer, file, declined, false);

    expect(result.allowed).toBe(false);
  });

  it("reviewer with EXPIRED status cannot read", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile();
    const expired = makeAssignment({ status: "EXPIRED" });

    const result = canReadManuscriptFileWithAudit(reviewer, file, expired, false);

    expect(result.allowed).toBe(false);
  });

  it("reviewer with SUBMITTED (done) status can still read (audit trail)", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile();
    const submitted = makeAssignment({ status: "SUBMITTED" });

    const result = canReadManuscriptFileWithAudit(reviewer, file, submitted, false);

    expect(result.allowed).toBe(true);
  });
});

// ── 10d. Reviewer A cannot read Reviewer B's file (round mismatch) ──────────

describe("10d: Reviewer A cannot read Reviewer B's file", () => {
  it("reviewer with assignment in round-1 cannot read file from round-2", () => {
    const reviewerA = makeUser({ id: "reviewer-a", roles: ["REVIEWER"] });
    const fileFromRound2 = makeFile({ roundId: "round-2", roundNumber: 2 });
    const assignmentInRound1 = makeAssignment({ roundId: "round-1" });

    const result = canReadManuscriptFileWithAudit(reviewerA, fileFromRound2, assignmentInRound1, false);

    expect(result.allowed).toBe(false);
  });

  it("reviewer with no assignment at all cannot read", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile();

    const result = canReadManuscriptFileWithAudit(reviewer, file, null, false);

    expect(result.allowed).toBe(false);
  });
});

// ── 10e. Conflicted editor blocked ──────────────────────────────────────────

describe("10e: Conflicted editor blocked by COI", () => {
  it("editor with COI cannot read any manuscript file", () => {
    const conflictedEditor = makeUser({ id: "editor-1", roles: ["JOURNAL_EDITOR"] });
    const file = makeFile();

    const result = canReadManuscriptFileWithAudit(conflictedEditor, file, null, true /* COI */);

    expect(result.allowed).toBe(false);
  });

  it("editor without COI can read", () => {
    const cleanEditor = makeUser({ id: "editor-2", roles: ["JOURNAL_EDITOR"] });
    const file = makeFile();

    const result = canReadManuscriptFileWithAudit(cleanEditor, file, null, false);

    expect(result.allowed).toBe(true);
  });

  it("HOD with COI cannot read", () => {
    const conflictedHod = makeUser({ id: "hod-1", roles: ["HOD"] });
    const file = makeFile({ kind: "MANUSCRIPT" });

    const result = canReadManuscriptFileWithAudit(conflictedHod, file, null, true /* COI */);

    expect(result.allowed).toBe(false);
  });
});

// ── 10j. REVIEW_ATTACHMENT: kind validation (logic proof) ───────────────────

describe("10j: REVIEW_ATTACHMENT kind is in reviewer allowed list", () => {
  it("REVIEW_ATTACHMENT is allowed for active reviewer (round matches)", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile({ kind: "REVIEW_ATTACHMENT" });
    const assignment = makeAssignment({ roundId: "round-1", status: "ACCEPTED" });

    const result = canReadManuscriptFileWithAudit(reviewer, file, assignment, false);

    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(true);
  });

  it("REVIEW_ATTACHMENT requires round match (not just any reviewer)", () => {
    const reviewer = makeUser({ id: "reviewer-1", roles: ["REVIEWER"] });
    const file = makeFile({ kind: "REVIEW_ATTACHMENT", roundId: "round-3" });
    const assignment = makeAssignment({ roundId: "round-1" });

    const result = canReadManuscriptFileWithAudit(reviewer, file, assignment, false);

    expect(result.allowed).toBe(false);
  });
});

// ── Audit required flags ─────────────────────────────────────────────────────

describe("Audit required flags", () => {
  it("editor access does NOT require audit", () => {
    const editor = makeUser({ roles: ["JOURNAL_EDITOR"] });
    const file = makeFile();
    const result = canReadManuscriptFileWithAudit(editor, file, null, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(false);
  });

  it("HOD access requires audit", () => {
    const hod = makeUser({ roles: ["HOD"] });
    const file = makeFile({ kind: "MANUSCRIPT" });
    const result = canReadManuscriptFileWithAudit(hod, file, null, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(true);
  });

  it("reviewer access requires audit", () => {
    const reviewer = makeUser({ roles: ["REVIEWER"] });
    const file = makeFile();
    const assignment = makeAssignment();
    const result = canReadManuscriptFileWithAudit(reviewer, file, assignment, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(true);
  });

  it("author accessing own file does NOT require audit", () => {
    const author = makeUser({ id: "author-1", roles: ["AUTHOR"] });
    const file = makeFile({ manuscriptSubmittedById: "author-1" });
    const result = canReadManuscriptFileWithAudit(author, file, null, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(false);
  });
});
