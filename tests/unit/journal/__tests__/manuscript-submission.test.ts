import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "../../database/test-db";

const db = await getTestDb();

if (db === null) {
  console.warn("[manuscript-submission.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

let createdManuscriptIds: string[] = [];
let createdUserIds: string[] = [];

describe.skipIf(db === null)("manuscript submission service", () => {
  afterEach(async () => {
    if (createdManuscriptIds.length > 0) {
      await db!.manuscriptFile.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptEvent.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptRound.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptAuthor.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscript.deleteMany({ where: { id: { in: createdManuscriptIds } } });
      createdManuscriptIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await db!.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db!.journalCounter.deleteMany({ where: {} });
      await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function makeVerifiedAuthor(email: string) {
    const user = await db!.user.create({
      data: {
        email,
        name: "Test Author",
        roles: { create: [{ role: "AUTHOR" }] },
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function makeUnverifiedAuthor(email: string) {
    const user = await db!.user.create({
      data: {
        email,
        name: "Unverified Author",
        roles: { create: [{ role: "AUTHOR" }] },
        isActive: true,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("createDraft: creates INCOMPLETE manuscript with no reference", async () => {
    const { createDraft } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("draft-create@example.com");

    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    const ms = await db!.manuscript.findUnique({ where: { id: draft.id } });
    expect(ms!.status).toBe("INCOMPLETE");
    expect(ms!.reference).toBeNull();
    expect(ms!.submittedById).toBe(user.id);
  });

  it("updateDraftStep: validates step1 including Yoruba diacritics in title", async () => {
    const { createDraft, updateDraftStep } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("draft-step1@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await expect(
      updateDraftStep(db!, user.id, draft.id, 1, {
        articleType: "RESEARCH_ARTICLE",
        title: "Eko ni Mathematics: Àgbàdo ati Formulas",
        abstract: "An abstract about mathematics.",
        keywords: ["math", "algebra", "topology"],
      }),
    ).resolves.not.toThrow();
  });

  it("updateDraftStep: rejects angle brackets in title", async () => {
    const { createDraft, updateDraftStep } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("draft-step1-xss@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await expect(
      updateDraftStep(db!, user.id, draft.id, 1, {
        articleType: "RESEARCH_ARTICLE",
        title: "<script>alert(1)</script>",
        abstract: "An abstract.",
        keywords: ["math", "algebra", "topology"],
      }),
    ).rejects.toThrow();
  });

  it("updateDraftStep: rejects < 3 keywords", async () => {
    const { createDraft, updateDraftStep } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("draft-step1-kw@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await expect(
      updateDraftStep(db!, user.id, draft.id, 1, {
        articleType: "RESEARCH_ARTICLE",
        title: "A valid title",
        abstract: "An abstract.",
        keywords: ["only-two"],
      }),
    ).rejects.toThrow();
  });

  it("updateDraftStep: rejects ORCID with invalid checksum", async () => {
    const { createDraft, updateDraftStep } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("draft-step2-orcid@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await expect(
      updateDraftStep(db!, user.id, draft.id, 2, {
        authors: [
          {
            name: "Bad ORCID Author",
            email: "bad@example.com",
            orcid: "0000-0002-1825-0099", // invalid checksum digit
            isCorresponding: true,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it("updateDraftStep: requires exactly one corresponding author", async () => {
    const { createDraft, updateDraftStep } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("draft-step2-corr@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await expect(
      updateDraftStep(db!, user.id, draft.id, 2, {
        authors: [
          { name: "Author One", isCorresponding: false },
          { name: "Author Two", isCorresponding: false },
        ],
      }),
    ).rejects.toThrow();
  });

  it("submitManuscript: INCOMPLETE → SUBMITTED, sets submittedAt and reference", async () => {
    const { createDraft, updateDraftStep, submitManuscript } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("submit-ok@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await updateDraftStep(db!, user.id, draft.id, 1, {
      articleType: "RESEARCH_ARTICLE",
      title: "A complete manuscript",
      abstract: "An abstract.",
      keywords: ["math", "algebra", "topology"],
    });
    await updateDraftStep(db!, user.id, draft.id, 2, {
      authors: [{ name: "Test Author", email: "submit-ok@example.com", isCorresponding: true }],
    });
    await updateDraftStep(db!, user.id, draft.id, 3, {
      coverLetter: "Please consider this paper.",
      suggestedReviewers: [],
      excludedReviewers: [],
      anonymisedConfirmed: true,
    });
    await updateDraftStep(db!, user.id, draft.id, 4, {
      agreementVersion: "JOURNAL_AUTHOR_AGREEMENT_V1",
      agreementAcceptedAt: new Date().toISOString(),
    });

    // Add a MANUSCRIPT file
    await db!.manuscriptFile.create({
      data: {
        manuscriptId: draft.id,
        kind: "MANUSCRIPT",
        originalName: "paper.pdf",
        mimeType: "application/pdf",
        size: 1024,
        sha256: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
        storageKey: "test/paper.pdf",
        uploadedById: user.id,
      },
    });

    const result = await submitManuscript(db!, user.id, draft.id);
    expect(result.reference).toMatch(/^MS-\d{4}-\d{4}$/);

    const ms = await db!.manuscript.findUnique({ where: { id: draft.id } });
    expect(ms!.status).toBe("SUBMITTED");
    expect(ms!.submittedAt).not.toBeNull();
    expect(ms!.reference).toBe(result.reference);
  });

  it("submitManuscript: unverified email throws", async () => {
    const { createDraft, submitManuscript } = await import("@/server/services/manuscript-submission");
    const user = await makeUnverifiedAuthor("submit-unverified@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await expect(submitManuscript(db!, user.id, draft.id)).rejects.toThrow();
  });

  it("submitManuscript: missing MANUSCRIPT file throws", async () => {
    const { createDraft, updateDraftStep, submitManuscript } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("submit-nofile@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await updateDraftStep(db!, user.id, draft.id, 1, {
      articleType: "RESEARCH_ARTICLE",
      title: "A complete manuscript",
      abstract: "An abstract.",
      keywords: ["math", "algebra", "topology"],
    });
    await updateDraftStep(db!, user.id, draft.id, 2, {
      authors: [{ name: "Test Author", email: "submit-nofile@example.com", isCorresponding: true }],
    });
    await updateDraftStep(db!, user.id, draft.id, 3, {
      coverLetter: "Please consider this paper.",
      suggestedReviewers: [],
      excludedReviewers: [],
      anonymisedConfirmed: true,
    });
    await updateDraftStep(db!, user.id, draft.id, 4, {
      agreementVersion: "JOURNAL_AUTHOR_AGREEMENT_V1",
      agreementAcceptedAt: new Date().toISOString(),
    });

    await expect(submitManuscript(db!, user.id, draft.id)).rejects.toThrow();
  });

  it("submitManuscript: creates ManuscriptRound number 1", async () => {
    const { createDraft, updateDraftStep, submitManuscript } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("submit-round@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await updateDraftStep(db!, user.id, draft.id, 1, {
      articleType: "RESEARCH_ARTICLE",
      title: "Round test",
      abstract: "Abstract.",
      keywords: ["a", "b", "c"],
    });
    await updateDraftStep(db!, user.id, draft.id, 2, {
      authors: [{ name: "Author", email: "submit-round@example.com", isCorresponding: true }],
    });
    await updateDraftStep(db!, user.id, draft.id, 3, {
      coverLetter: "Letter.",
      suggestedReviewers: [],
      excludedReviewers: [],
      anonymisedConfirmed: true,
    });
    await updateDraftStep(db!, user.id, draft.id, 4, {
      agreementVersion: "JOURNAL_AUTHOR_AGREEMENT_V1",
      agreementAcceptedAt: new Date().toISOString(),
    });
    await db!.manuscriptFile.create({
      data: {
        manuscriptId: draft.id,
        kind: "MANUSCRIPT",
        originalName: "paper.pdf",
        mimeType: "application/pdf",
        size: 1024,
        sha256: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778811",
        storageKey: "test/paper-round.pdf",
        uploadedById: user.id,
      },
    });

    await submitManuscript(db!, user.id, draft.id);

    const rounds = await db!.manuscriptRound.findMany({ where: { manuscriptId: draft.id } });
    expect(rounds).toHaveLength(1);
    expect(rounds[0].number).toBe(1);
  });

  it("submitManuscript: creates ManuscriptEvent SUBMITTED with visibleToAuthor true", async () => {
    const { createDraft, updateDraftStep, submitManuscript } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("submit-event@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    await updateDraftStep(db!, user.id, draft.id, 1, {
      articleType: "RESEARCH_ARTICLE",
      title: "Event test",
      abstract: "Abstract.",
      keywords: ["a", "b", "c"],
    });
    await updateDraftStep(db!, user.id, draft.id, 2, {
      authors: [{ name: "Author", email: "submit-event@example.com", isCorresponding: true }],
    });
    await updateDraftStep(db!, user.id, draft.id, 3, {
      coverLetter: "Letter.",
      suggestedReviewers: [],
      excludedReviewers: [],
      anonymisedConfirmed: true,
    });
    await updateDraftStep(db!, user.id, draft.id, 4, {
      agreementVersion: "JOURNAL_AUTHOR_AGREEMENT_V1",
      agreementAcceptedAt: new Date().toISOString(),
    });
    await db!.manuscriptFile.create({
      data: {
        manuscriptId: draft.id,
        kind: "MANUSCRIPT",
        originalName: "paper.pdf",
        mimeType: "application/pdf",
        size: 1024,
        sha256: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778822",
        storageKey: "test/paper-event.pdf",
        uploadedById: user.id,
      },
    });

    await submitManuscript(db!, user.id, draft.id);

    const events = await db!.manuscriptEvent.findMany({ where: { manuscriptId: draft.id, type: "SUBMITTED" } });
    expect(events).toHaveLength(1);
    expect(events[0].visibleToAuthor).toBe(true);
  });

  it("submitManuscript: AuditLog summary contains no title or author name", async () => {
    const { createDraft, updateDraftStep, submitManuscript } = await import("@/server/services/manuscript-submission");
    const user = await makeVerifiedAuthor("submit-audit@example.com");
    const draft = await createDraft(db!, user.id);
    createdManuscriptIds.push(draft.id);

    const secretTitle = "SECRET_TITLE_SHOULD_NOT_APPEAR_IN_AUDIT";
    await updateDraftStep(db!, user.id, draft.id, 1, {
      articleType: "RESEARCH_ARTICLE",
      title: secretTitle,
      abstract: "Abstract.",
      keywords: ["a", "b", "c"],
    });
    await updateDraftStep(db!, user.id, draft.id, 2, {
      authors: [{ name: "SECRET_AUTHOR_NAME", email: "submit-audit@example.com", isCorresponding: true }],
    });
    await updateDraftStep(db!, user.id, draft.id, 3, {
      coverLetter: "Letter.",
      suggestedReviewers: [],
      excludedReviewers: [],
      anonymisedConfirmed: true,
    });
    await updateDraftStep(db!, user.id, draft.id, 4, {
      agreementVersion: "JOURNAL_AUTHOR_AGREEMENT_V1",
      agreementAcceptedAt: new Date().toISOString(),
    });
    await db!.manuscriptFile.create({
      data: {
        manuscriptId: draft.id,
        kind: "MANUSCRIPT",
        originalName: "paper.pdf",
        mimeType: "application/pdf",
        size: 1024,
        sha256: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778833",
        storageKey: "test/paper-audit.pdf",
        uploadedById: user.id,
      },
    });

    await submitManuscript(db!, user.id, draft.id);

    const logs = await db!.auditLog.findMany({
      where: { actorId: user.id, entityType: "Manuscript" },
    });
    for (const log of logs) {
      expect(log.summary).not.toContain(secretTitle);
      expect(log.summary).not.toContain("SECRET_AUTHOR_NAME");
    }
  });
});

describe("assignReference", () => {
  afterEach(async () => {
    // clean up JournalCounter rows
    await db?.journalCounter.deleteMany({ where: {} });
  });

  it("returns MS-YYYY-0001 for first submission of the year", async () => {
    const { assignReference } = await import("@/server/services/manuscript-submission");
    const ref = await assignReference(db!, 2026);
    expect(ref).toMatch(/^MS-2026-\d{4}$/);
    expect(ref).toBe("MS-2026-0001");
  });

  it("concurrent calls produce unique sequential references", async () => {
    const { assignReference } = await import("@/server/services/manuscript-submission");
    const refs = await Promise.all(Array.from({ length: 10 }, () => assignReference(db!, 2026)));
    const unique = new Set(refs);
    expect(unique.size).toBe(10);
  });

  it("year rollover resets counter", async () => {
    const { assignReference } = await import("@/server/services/manuscript-submission");
    const ref2025 = await assignReference(db!, 2025);
    const ref2026 = await assignReference(db!, 2026);
    expect(ref2025).toBe("MS-2025-0001");
    expect(ref2026).toBe("MS-2026-0001");
  });
});

describe("validateOrcid", () => {
  it("accepts a valid ORCID", async () => {
    const { validateOrcid } = await import("@/server/services/manuscript-submission");
    // 0000-0002-1825-0097 is a valid ORCID (checksum digit 7)
    expect(validateOrcid("0000-0002-1825-0097")).toBe(true);
  });

  it("rejects an invalid checksum", async () => {
    const { validateOrcid } = await import("@/server/services/manuscript-submission");
    expect(validateOrcid("0000-0002-1825-0099")).toBe(false);
  });

  it("rejects wrong format", async () => {
    const { validateOrcid } = await import("@/server/services/manuscript-submission");
    expect(validateOrcid("not-an-orcid")).toBe(false);
  });
});
