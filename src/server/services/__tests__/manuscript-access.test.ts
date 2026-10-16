import { describe, expect, it } from "vitest";
import {
  canReadManuscriptFile,
  canDownloadAs,
  type ManuscriptFileAccessInput,
  type ReviewerAssignmentInput,
} from "../manuscript-access";
import type { SessionUser } from "@/lib/rbac";

function user(roles: SessionUser["roles"], overrides: Partial<SessionUser> = {}): SessionUser {
  return { id: "user-1", roles, isActive: true, ...overrides };
}

function file(overrides: Partial<ManuscriptFileAccessInput> = {}): ManuscriptFileAccessInput {
  return {
    id: "file-1",
    kind: "MANUSCRIPT",
    roundId: "round-1",
    roundNumber: 1,
    manuscriptId: "ms-1",
    manuscriptSubmittedById: "author-1",
    originalName: "my-real-paper.pdf",
    ...overrides,
  };
}

describe("canReadManuscriptFile", () => {
  it("SUPER_ADMIN may read any file, any kind, any round", () => {
    const u = user(["SUPER_ADMIN"]);
    expect(canReadManuscriptFile(u, file({ kind: "COPYEDITED" }), null, false)).toBe(true);
  });

  it("JOURNAL_EDITOR_IN_CHIEF may read any file", () => {
    expect(canReadManuscriptFile(user(["JOURNAL_EDITOR_IN_CHIEF"]), file({ kind: "COPYEDITED" }), null, false)).toBe(
      true,
    );
  });

  it("JOURNAL_EDITOR may read any file", () => {
    expect(canReadManuscriptFile(user(["JOURNAL_EDITOR"]), file({ kind: "COPYEDITED" }), null, false)).toBe(true);
  });

  it("HOD has read access to non-COI manuscript files (decision #58 - journal.manuscripts.read)", () => {
    expect(canReadManuscriptFile(user(["HOD"]), file(), null, false)).toBe(true);
  });

  it("HOD is denied when COI applies", () => {
    expect(canReadManuscriptFile(user(["HOD"]), file(), null, true)).toBe(false);
  });

  it("HOD is denied TITLE_PAGE even without COI", () => {
    expect(canReadManuscriptFile(user(["HOD"]), file({ kind: "TITLE_PAGE" }), null, false)).toBe(false);
  });

  it("ADMIN gets NO access to manuscript files", () => {
    expect(canReadManuscriptFile(user(["ADMIN"]), file(), null, false)).toBe(false);
  });

  it("HOD who ALSO holds a journal editor role gets access (holds both roles at once)", () => {
    expect(canReadManuscriptFile(user(["HOD", "JOURNAL_EDITOR"]), file(), null, false)).toBe(true);
  });

  it("AUTHOR may read a file of their own submitted manuscript, any kind, any round", () => {
    const u = user(["AUTHOR"], { id: "author-1" });
    expect(canReadManuscriptFile(u, file({ kind: "COPYEDITED", roundId: "round-7" }), null, false)).toBe(true);
  });

  it("AUTHOR may not read a file of a manuscript submitted by someone else (cross-author access)", () => {
    const u = user(["AUTHOR"], { id: "author-2" });
    expect(canReadManuscriptFile(u, file({ manuscriptSubmittedById: "author-1" }), null, false)).toBe(false);
  });

  it("AUTHOR gets no access when the manuscript has no submittedById at all", () => {
    const u = user(["AUTHOR"], { id: "author-1" });
    expect(canReadManuscriptFile(u, file({ manuscriptSubmittedById: null }), null, false)).toBe(false);
  });

  it("REVIEWER may read MANUSCRIPT/SUPPLEMENTARY/REVISED/RESPONSE_TO_REVIEWERS for their ACCEPTED assignment's round", () => {
    const u = user(["REVIEWER"], { id: "reviewer-1" });
    const assignment: ReviewerAssignmentInput = { roundId: "round-1", status: "ACCEPTED" };
    for (const kind of ["MANUSCRIPT", "SUPPLEMENTARY", "REVISED", "RESPONSE_TO_REVIEWERS"] as const) {
      expect(canReadManuscriptFile(u, file({ kind }), assignment, false)).toBe(true);
    }
  });

  it("REVIEWER may read via a SUBMITTED assignment too (already submitted, still allowed to re-download)", () => {
    const u = user(["REVIEWER"], { id: "reviewer-1" });
    const assignment: ReviewerAssignmentInput = { roundId: "round-1", status: "SUBMITTED" };
    expect(canReadManuscriptFile(u, file(), assignment, false)).toBe(true);
  });

  it("REVIEWER may NEVER read a COPYEDITED file", () => {
    const u = user(["REVIEWER"], { id: "reviewer-1" });
    const assignment: ReviewerAssignmentInput = { roundId: "round-1", status: "ACCEPTED" };
    expect(canReadManuscriptFile(u, file({ kind: "COPYEDITED" }), assignment, false)).toBe(false);
  });

  it("REVIEWER gets no access for the wrong round", () => {
    const u = user(["REVIEWER"], { id: "reviewer-1" });
    const assignment: ReviewerAssignmentInput = { roundId: "round-2", status: "ACCEPTED" };
    expect(canReadManuscriptFile(u, file({ roundId: "round-1" }), assignment, false)).toBe(false);
  });

  it("REVIEWER gets no access when the file has no round at all", () => {
    const u = user(["REVIEWER"], { id: "reviewer-1" });
    const assignment: ReviewerAssignmentInput = { roundId: "round-1", status: "ACCEPTED" };
    expect(canReadManuscriptFile(u, file({ roundId: null }), assignment, false)).toBe(false);
  });

  for (const status of ["INVITED", "DECLINED", "EXPIRED"] as const) {
    it(`REVIEWER gets no access with assignment status ${status}`, () => {
      const u = user(["REVIEWER"], { id: "reviewer-1" });
      const assignment: ReviewerAssignmentInput = { roundId: "round-1", status };
      expect(canReadManuscriptFile(u, file(), assignment, false)).toBe(false);
    });
  }

  it("REVIEWER with no assignment at all for this manuscript gets no access", () => {
    const u = user(["REVIEWER"], { id: "reviewer-1" });
    expect(canReadManuscriptFile(u, file(), null, false)).toBe(false);
  });

  it("an unrelated LECTURER gets no access", () => {
    expect(canReadManuscriptFile(user(["LECTURER"]), file(), null, false)).toBe(false);
  });

  it("a deactivated user gets no access even with SUPER_ADMIN role", () => {
    const u = user(["SUPER_ADMIN"], { isActive: false });
    expect(canReadManuscriptFile(u, file(), null, false)).toBe(false);
  });

  it("a user with multiple unrelated roles still gets no access if none grant it", () => {
    expect(canReadManuscriptFile(user(["LECTURER", "ADMIN"]), file(), null, false)).toBe(false);
  });
});

describe("canDownloadAs", () => {
  it("an editor sees the real original filename", () => {
    const result = canDownloadAs(user(["JOURNAL_EDITOR"]), file(), null, false);
    expect(result).toEqual({ allowed: true, displayFilename: "my-real-paper.pdf", auditRequired: false });
  });

  it("the author sees the real original filename", () => {
    const u = user(["AUTHOR"], { id: "author-1" });
    const result = canDownloadAs(u, file(), null, false);
    expect(result).toEqual({ allowed: true, displayFilename: "my-real-paper.pdf", auditRequired: false });
  });

  it("a reviewer sees a generic, round-numbered filename, never the real one (blind review)", () => {
    const u = user(["REVIEWER"], { id: "reviewer-1" });
    const assignment: ReviewerAssignmentInput = { roundId: "round-1", status: "ACCEPTED" };
    const result = canDownloadAs(u, file({ roundNumber: 3 }), assignment, false);
    expect(result).toEqual({ allowed: true, displayFilename: "manuscript-round-3.pdf", auditRequired: true });
  });

  it("denied access returns allowed: false with no filename", () => {
    const result = canDownloadAs(user(["LECTURER"]), file(), null, false);
    expect(result).toEqual({ allowed: false, displayFilename: null });
  });

  it("HOD sees real filename and auditRequired: true", () => {
    const result = canDownloadAs(user(["HOD"]), file(), null, false);
    expect(result).toEqual({ allowed: true, displayFilename: "my-real-paper.pdf", auditRequired: true });
  });

  it("SUPER_ADMIN sees real filename and auditRequired: true", () => {
    const result = canDownloadAs(user(["SUPER_ADMIN"]), file(), null, false);
    expect(result).toEqual({ allowed: true, displayFilename: "my-real-paper.pdf", auditRequired: true });
  });
});
