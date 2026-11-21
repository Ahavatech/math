import { describe, it, expect, beforeEach } from "vitest";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { submitRevision, getRevisionState } from "@/server/services/manuscript-revision";
import { processManuscriptUpload, deleteManuscriptFile } from "@/server/services/manuscript-upload";

const db = await getTestDb();

const LONG_REPLY = "We have changed the proof in section 3 and added the missing hypothesis, as asked.";

async function scenario(runId: string, status: "REVISION_REQUESTED" | "UNDER_REVIEW" = "REVISION_REQUESTED") {
  const author = await db!.user.create({
    data: { id: `au-r-${runId}`, email: `au-r-${runId}@test.com`, name: "Author", emailVerifiedAt: new Date() },
  });
  const other = await db!.user.create({ data: { id: `ot-r-${runId}`, email: `ot-r-${runId}@test.com`, name: "Other" } });
  const ms = await db!.manuscript.create({
    data: {
      id: `ms-r-${runId}`,
      title: "Revision Test",
      abstract: "Abstract",
      keywords: [],
      submittedById: author.id,
      status,
      currentRound: 2,
      reference: `MS-9999-${runId}`,
    },
  });
  await db!.manuscriptRound.create({ data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() } });
  const round2 = await db!.manuscriptRound.create({ data: { manuscriptId: ms.id, number: 2, submittedAt: new Date() } });
  return { author, other, ms, round2 };
}

function pdfStream() {
  return Readable.from([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")]);
}

function upload(userId: string, manuscriptId: string, kind: string) {
  return processManuscriptUpload(db!, {
    userId,
    manuscriptId,
    kind,
    originalName: "revised.pdf",
    mimeType: "application/pdf",
    stream: pdfStream(),
    hasXRequestedWith: true,
    origin: null,
  });
}

describe.skipIf(db === null)("revise and resubmit", () => {
  let runId: string;
  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  it("refuses to send a revision with no revised file", async () => {
    const { author, ms } = await scenario(runId);
    await expect(submitRevision(db!, author.id, ms.id, { response: LONG_REPLY })).rejects.toThrow(/revised manuscript/i);
  });

  it("refuses a response that is too short", async () => {
    const { author, ms } = await scenario(runId);
    await upload(author.id, ms.id, "REVISED");
    await expect(submitRevision(db!, author.id, ms.id, { response: "ok" })).rejects.toThrow();
  });

  it("accepts a revised file into the new round, then moves the manuscript back to review", async () => {
    const { author, ms, round2 } = await scenario(runId);
    const file = await upload(author.id, ms.id, "REVISED");
    expect(file.size).toBeGreaterThan(0);

    const stored = await db!.manuscriptFile.findFirst({ where: { manuscriptId: ms.id, kind: "REVISED" } });
    expect(stored?.roundId).toBe(round2.id);

    const result = await submitRevision(db!, author.id, ms.id, { response: LONG_REPLY });
    expect(result.round).toBe(2);

    const after = await db!.manuscript.findUnique({ where: { id: ms.id } });
    expect(after?.status).toBe("UNDER_REVIEW");
    const round = await db!.manuscriptRound.findUnique({ where: { id: round2.id } });
    expect(round?.responseToReviewers).toBe(LONG_REPLY);
    expect(round?.resubmittedAt).not.toBeNull();
    const events = await db!.manuscriptEvent.findMany({ where: { manuscriptId: ms.id, type: "RESUBMITTED" } });
    expect(events).toHaveLength(1);
    const audit = await db!.auditLog.findMany({ where: { entityId: ms.id, action: "journal.manuscript.resubmit_revision" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.summary).not.toContain(LONG_REPLY);
  });

  it("cannot be sent twice", async () => {
    const { author, ms } = await scenario(runId);
    await upload(author.id, ms.id, "REVISED");
    await submitRevision(db!, author.id, ms.id, { response: LONG_REPLY });
    await expect(submitRevision(db!, author.id, ms.id, { response: LONG_REPLY })).rejects.toThrow(/not been requested/i);
  });

  it("is not available to someone else's manuscript or to a manuscript not awaiting revision", async () => {
    const { other, author, ms } = await scenario(runId);
    await expect(submitRevision(db!, other.id, ms.id, { response: LONG_REPLY })).rejects.toThrow(/not found/i);
    await expect(getRevisionState(db!, other.id, ms.id)).rejects.toThrow(/not found/i);
    await expect(upload(other.id, ms.id, "REVISED")).rejects.toThrow(/not found/i);

    const second = await scenario(`${runId}b`, "UNDER_REVIEW");
    await expect(submitRevision(db!, second.author.id, second.ms.id, { response: LONG_REPLY })).rejects.toThrow(
      /not been requested/i,
    );
    expect(author.id).not.toBe(other.id);
  });

  it("only takes revision kinds during a revision and keeps the original files", async () => {
    const { author, ms } = await scenario(runId);
    await expect(upload(author.id, ms.id, "MANUSCRIPT")).rejects.toThrow(/status/i);

    // An original file from round 1 cannot be deleted now.
    const original = await db!.manuscriptFile.create({
      data: {
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "first.pdf",
        storageKey: `none-${runId}`,
        mimeType: "application/pdf",
        size: 10,
        sha256: "x",
      },
    });
    await expect(deleteManuscriptFile(db!, { userId: author.id, fileId: original.id })).rejects.toThrow();
  });

  it("replaces an earlier revised file rather than piling them up", async () => {
    const { author, ms } = await scenario(runId);
    await upload(author.id, ms.id, "REVISED");
    await upload(author.id, ms.id, "REVISED");
    const files = await db!.manuscriptFile.findMany({ where: { manuscriptId: ms.id, kind: "REVISED" } });
    expect(files).toHaveLength(1);
  });
});
