import "server-only";
import type { PrismaClient } from "@prisma/client";
import { step1Schema, step2Schema, step3Schema, step4Schema } from "@/lib/validators/manuscript";
import { logAction } from "@/server/services/audit";

export const JOURNAL_AUTHOR_AGREEMENT_V1 = "JOURNAL_AUTHOR_AGREEMENT_V1";

/**
 * Validates an ORCID identifier using the ISO 27729 Luhn mod-11 algorithm.
 * Format: XXXX-XXXX-XXXX-XXXX where the last character may be a digit or X.
 */
export function validateOrcid(orcid: string): boolean {
  const clean = orcid.replace(/-/g, "");
  if (!/^\d{15}[\dX]$/.test(clean)) return false;
  let total = 0;
  for (let i = 0; i < 15; i++) {
    total = (total + parseInt(clean[i]!, 10)) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const checkChar = result === 10 ? "X" : String(result);
  return clean[15] === checkChar;
}

export async function createDraft(
  db: PrismaClient,
  userId: string,
): Promise<{ id: string }> {
  const ms = await db.manuscript.create({
    data: {
      title: "",
      abstract: "",
      keywords: [],
      status: "INCOMPLETE",
      submittedById: userId,
    },
  });
  return { id: ms.id };
}

type StepData = Record<string, unknown>;

export async function updateDraftStep(
  db: PrismaClient,
  userId: string,
  manuscriptId: string,
  step: 1 | 2 | 3 | 4,
  data: StepData,
): Promise<void> {
  // Ownership check
  const ms = await db.manuscript.findUnique({ where: { id: manuscriptId }, select: { submittedById: true, status: true } });
  if (!ms || ms.submittedById !== userId) throw new Error("Manuscript not found or not owned by user");
  if (ms.status !== "INCOMPLETE") throw new Error("Cannot update a submitted manuscript");

  if (step === 1) {
    const parsed = step1Schema.parse(data);
    await db.manuscript.update({
      where: { id: manuscriptId },
      data: {
        articleType: parsed.articleType,
        title: parsed.title,
        abstract: parsed.abstract,
        keywords: parsed.keywords,
      },
    });
  } else if (step === 2) {
    const parsed = step2Schema.parse(data);
    // Validate ORCIDs
    for (const author of parsed.authors) {
      if (author.orcid && !validateOrcid(author.orcid)) {
        throw new Error(`Invalid ORCID checksum: ${author.orcid}`);
      }
    }
    // Replace authors
    await db.manuscriptAuthor.deleteMany({ where: { manuscriptId } });
    for (let i = 0; i < parsed.authors.length; i++) {
      const a = parsed.authors[i]!;
      await db.manuscriptAuthor.create({
        data: {
          manuscriptId,
          name: a.name,
          affiliation: a.affiliation,
          email: a.email,
          orcid: a.orcid,
          isCorresponding: a.isCorresponding,
          order: i,
        },
      });
    }
  } else if (step === 3) {
    const parsed = step3Schema.parse(data);
    await db.manuscript.update({
      where: { id: manuscriptId },
      data: {
        coverLetter: parsed.coverLetter,
        suggestedReviewers: parsed.suggestedReviewers,
        excludedReviewers: parsed.excludedReviewers,
        anonymisedConfirmedAt: new Date(),
      },
    });
  } else if (step === 4) {
    const parsed = step4Schema.parse(data);
    await db.manuscript.update({
      where: { id: manuscriptId },
      data: {
        agreementVersion: parsed.agreementVersion,
        agreementAcceptedAt: new Date(parsed.agreementAcceptedAt),
      },
    });
  }
}

/**
 * Assigns a unique reference number atomically using an upsert+increment
 * on JournalCounter. Returns e.g. "MS-2026-0001".
 */
export async function assignReference(
  db: PrismaClient,
  year: number,
): Promise<string> {
  // PostgreSQL: atomic increment using raw query to avoid race conditions
  const result = await db.$queryRaw<[{ value: number }]>`
    INSERT INTO "JournalCounter" ("year", "value")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
      SET "value" = "JournalCounter"."value" + 1
    RETURNING "value"
  `;
  const seq = result[0]!.value;
  return `MS-${year}-${String(seq).padStart(4, "0")}`;
}

export async function submitManuscript(
  db: PrismaClient,
  userId: string,
  manuscriptId: string,
): Promise<{ reference: string }> {
  // Verify user has confirmed email
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (!user?.emailVerifiedAt) {
    throw new Error("Email must be verified before submitting");
  }

  // Verify manuscript exists, is owned by user, and is INCOMPLETE
  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    include: { files: { select: { kind: true } } },
  });
  if (!ms || ms.submittedById !== userId) {
    throw new Error("Manuscript not found or not owned by user");
  }
  if (ms.status !== "INCOMPLETE") {
    throw new Error("Manuscript is not in INCOMPLETE status");
  }

  // Require MANUSCRIPT file
  const hasManuscriptFile = ms.files.some((f) => f.kind === "MANUSCRIPT");
  if (!hasManuscriptFile) {
    throw new Error("A manuscript file (MANUSCRIPT kind) must be uploaded before submitting");
  }

  const year = new Date().getFullYear();
  const reference = await assignReference(db, year);
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.manuscript.update({
      where: { id: manuscriptId },
      data: {
        status: "SUBMITTED",
        reference,
        submittedAt: now,
      },
    });

    // Create Round 1
    await tx.manuscriptRound.create({
      data: {
        manuscriptId,
        number: 1,
        submittedAt: now,
      },
    });

    // Workflow event
    await tx.manuscriptEvent.create({
      data: {
        manuscriptId,
        type: "SUBMITTED",
        actorId: userId,
        visibleToAuthor: true,
        note: null,
      },
    });

    // AuditLog — no title, abstract, filenames or author names (CLAUDE.md rule)
    await logAction(
      tx as unknown as PrismaClient,
      {
        actorId: userId,
        action: "journal.manuscript.submit",
        entityType: "Manuscript",
        entityId: manuscriptId,
        summary: `Manuscript submitted (ref: ${reference})`,
      },
    );
  });

  return { reference };
}
