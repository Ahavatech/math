import { describe, expect, it } from "vitest";
import {
  canReadManuscriptFile,
  canDownloadAs,
  type ManuscriptFileAccessInput,
  type ReviewerAssignmentInput,
} from "@/server/services/manuscript-access";
import type { SessionUser } from "@/lib/rbac";

function makeUser(roles: SessionUser["roles"], id = "user-1"): SessionUser {
  return { id, roles, isActive: true };
}

const baseFile: ManuscriptFileAccessInput = {
  id: "file-1",
  kind: "MANUSCRIPT",
  roundId: null,
  roundNumber: null,
  manuscriptId: "ms-1",
  manuscriptSubmittedById: "author-99",
  originalName: "paper.pdf",
};

const titlePageFile: ManuscriptFileAccessInput = {
  ...baseFile,
  kind: "TITLE_PAGE",
};

describe("canReadManuscriptFile — COI denial", () => {
  it("COI: editor who submitted the manuscript is denied", () => {
    const editor = makeUser(["JOURNAL_EDITOR"], "author-99");
    const file = { ...baseFile, manuscriptSubmittedById: "author-99" };
    expect(canReadManuscriptFile(editor, file, null, true)).toBe(false);
  });

  it("COI: JOURNAL_EDITOR_IN_CHIEF who is a co-author is denied", () => {
    const eic = makeUser(["JOURNAL_EDITOR_IN_CHIEF"], "eic-1");
    expect(canReadManuscriptFile(eic, baseFile, null, true)).toBe(false);
  });

  it("COI: SUPER_ADMIN who is an author is denied", () => {
    const sa = makeUser(["SUPER_ADMIN"], "sa-1");
    expect(canReadManuscriptFile(sa, baseFile, null, true)).toBe(false);
  });

  it("COI: HOD who is an author is denied", () => {
    const hod = makeUser(["HOD"], "hod-1");
    expect(canReadManuscriptFile(hod, baseFile, null, true)).toBe(false);
  });

  it("COI: AUTHOR still reads own manuscript even when COI flagged for editorial", () => {
    const author = makeUser(["AUTHOR"], "author-99");
    const file = { ...baseFile, manuscriptSubmittedById: "author-99" };
    // COI flag concerns editorial access; submitter always reads own work
    expect(canReadManuscriptFile(author, file, null, true)).toBe(true);
  });
});

describe("canReadManuscriptFile — HOD read-only", () => {
  it("HOD reads a non-COI manuscript", () => {
    const hod = makeUser(["HOD"]);
    expect(canReadManuscriptFile(hod, baseFile, null, false)).toBe(true);
  });

  it("HOD is denied on TITLE_PAGE", () => {
    const hod = makeUser(["HOD"]);
    expect(canReadManuscriptFile(hod, titlePageFile, null, false)).toBe(false);
  });

  it("ADMIN is always denied regardless of COI", () => {
    const admin = makeUser(["ADMIN"]);
    expect(canReadManuscriptFile(admin, baseFile, null, false)).toBe(false);
    expect(canReadManuscriptFile(admin, baseFile, null, true)).toBe(false);
  });
});

describe("canReadManuscriptFile — TITLE_PAGE blocked for reviewers", () => {
  const assignment: ReviewerAssignmentInput = { roundId: "round-1", status: "ACCEPTED" };
  const titlePageWithRound: ManuscriptFileAccessInput = {
    ...titlePageFile,
    roundId: "round-1",
    roundNumber: 1,
  };

  it("reviewer cannot read TITLE_PAGE even on accepted assignment", () => {
    const reviewer = makeUser(["REVIEWER"]);
    expect(canReadManuscriptFile(reviewer, titlePageWithRound, assignment, false)).toBe(false);
  });

  it("reviewer can still read MANUSCRIPT kind on accepted assignment", () => {
    const reviewer = makeUser(["REVIEWER"]);
    const manuscriptFile: ManuscriptFileAccessInput = {
      ...baseFile,
      roundId: "round-1",
      roundNumber: 1,
    };
    expect(canReadManuscriptFile(reviewer, manuscriptFile, assignment, false)).toBe(true);
  });
});

describe("canReadManuscriptFile — audit flag", () => {
  it("SUPER_ADMIN read returns auditRequired: true", () => {
    const sa = makeUser(["SUPER_ADMIN"]);
    const result = canReadManuscriptFileWithAudit(sa, baseFile, null, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(true);
  });

  it("HOD read returns auditRequired: true", () => {
    const hod = makeUser(["HOD"]);
    const result = canReadManuscriptFileWithAudit(hod, baseFile, null, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(true);
  });

  it("JOURNAL_EDITOR read returns auditRequired: false", () => {
    const editor = makeUser(["JOURNAL_EDITOR"]);
    const result = canReadManuscriptFileWithAudit(editor, baseFile, null, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(false);
  });

  it("AUTHOR read of own manuscript returns auditRequired: false", () => {
    const author = makeUser(["AUTHOR"], "author-99");
    const file = { ...baseFile, manuscriptSubmittedById: "author-99" };
    const result = canReadManuscriptFileWithAudit(author, file, null, false);
    expect(result.allowed).toBe(true);
    expect(result.auditRequired).toBe(false);
  });
});

// Import the richer return-value variant explicitly for audit tests
import { canReadManuscriptFileWithAudit } from "@/server/services/manuscript-access";

describe("canDownloadAs — TITLE_PAGE never shown to reviewers", () => {
  const assignment: ReviewerAssignmentInput = { roundId: "round-1", status: "ACCEPTED" };
  const titlePageWithRound: ManuscriptFileAccessInput = {
    ...titlePageFile,
    roundId: "round-1",
    roundNumber: 1,
  };

  it("reviewer download of TITLE_PAGE is denied", () => {
    const reviewer = makeUser(["REVIEWER"]);
    const d = canDownloadAs(reviewer, titlePageWithRound, assignment, false);
    expect(d.allowed).toBe(false);
  });
});

describe("canDownloadAs — HOD gets real filename", () => {
  it("HOD download shows real filename", () => {
    const hod = makeUser(["HOD"]);
    const d = canDownloadAs(hod, baseFile, null, false);
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.displayFilename).toBe("paper.pdf");
  });
});
