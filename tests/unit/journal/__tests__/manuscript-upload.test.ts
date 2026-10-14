import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { getTestDb } from "../../database/test-db";

const db = await getTestDb();

if (db === null) {
  console.warn("[manuscript-upload.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

// ---- helpers ---------------------------------------------------------------

function makeStream(bytes: Buffer): Readable {
  return Readable.from([bytes]);
}

/** Minimal valid PDF magic bytes + enough padding */
function makePdf(sizeBytes: number): Buffer {
  const header = Buffer.from("%PDF-1.4\n");
  const padding = Buffer.alloc(Math.max(0, sizeBytes - header.length), 0x20);
  return Buffer.concat([header, padding]);
}

/** Minimal valid DOCX: PK magic + word/document.xml entry name placeholder */
function makeDocx(sizeBytes = 5000): Buffer {
  const pk = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const entry = Buffer.from("word/document.xml");
  const filler = Buffer.alloc(Math.max(0, sizeBytes - pk.length - entry.length), 0x20);
  return Buffer.concat([pk, entry, filler]);
}

/** Fake executable magic (ELF) – not a valid PDF */
function makeElf(): Buffer {
  return Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, ...Buffer.alloc(248)]);
}

/** HTML content that has been renamed to .pdf */
function makeHtml(): Buffer {
  return Buffer.from("<!DOCTYPE html><html><body>evil</body></html>");
}

// ---- upload service under test ---------------------------------------------

import {
  processManuscriptUpload,
  deleteManuscriptFile,
  sanitiseFilename,
  extractDocxMetadataWarning,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "@/server/services/manuscript-upload";

// ---- per-test state --------------------------------------------------------

const createdManuscriptIds: string[] = [];
const createdUserIds: string[] = [];

describe.skipIf(db === null)("manuscript upload service", () => {
  afterEach(async () => {
    if (createdManuscriptIds.length > 0) {
      await db!.manuscriptFile.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscript.deleteMany({ where: { id: { in: createdManuscriptIds } } });
      createdManuscriptIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function makeUser(email: string) {
    const u = await db!.user.create({
      data: { email, name: "Test", emailVerifiedAt: new Date(), isActive: true },
    });
    createdUserIds.push(u.id);
    return u;
  }

  async function makeManuscript(userId: string, status = "INCOMPLETE") {
    const ms = await db!.manuscript.create({
      data: {
        title: "Test",
        abstract: "Abstract",
        keywords: ["a"],
        status: status as import("@prisma/client").ManuscriptStatus,
        submittedById: userId,
      },
    });
    createdManuscriptIds.push(ms.id);
    return ms;
  }

  // ---- sanitiseFilename (pure, no DB) ---------------------------------------

  it("sanitises path traversal in filename (../../etc/passwd → __etc_passwd)", () => {
    const result = sanitiseFilename("../../etc/passwd");
    expect(result).not.toContain("..");
    expect(result).not.toContain("/");
  });

  it("flattens double extension (malware.exe.pdf → malware_exe.pdf)", () => {
    const result = sanitiseFilename("malware.exe.pdf");
    // Should produce at most one dot before the last extension
    const parts = result.split(".");
    expect(parts.length).toBeLessThanOrEqual(2);
  });

  // ---- extractDocxMetadataWarning (pure, no DB) ----------------------------

  it("returns warning when DOCX creator field is non-empty", async () => {
    // Construct a minimal fake core.xml with a non-empty creator
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:creator>John Smith</dc:creator>
  <cp:lastModifiedBy></cp:lastModifiedBy>
</cp:coreProperties>`;
    const warning = await extractDocxMetadataWarning(Buffer.from(coreXml));
    expect(warning).toBeTruthy();
    expect(typeof warning).toBe("string");
  });

  it("returns null when DOCX creator and lastModifiedBy are empty", async () => {
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:creator></dc:creator>
  <cp:lastModifiedBy></cp:lastModifiedBy>
</cp:coreProperties>`;
    const warning = await extractDocxMetadataWarning(Buffer.from(coreXml));
    expect(warning).toBeNull();
  });

  it("returns null when no docProps/core.xml present", async () => {
    const warning = await extractDocxMetadataWarning(null);
    expect(warning).toBeNull();
  });

  // ---- processManuscriptUpload service (needs DB) --------------------------

  it("rejects upload without X-Requested-With header", async () => {
    const user = await makeUser("upload-no-xrw@example.com");
    const ms = await makeManuscript(user.id);

    await expect(
      processManuscriptUpload(db!, {
        userId: user.id,
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "thesis.pdf",
        mimeType: "application/pdf",
        stream: makeStream(makePdf(1000)),
        hasXRequestedWith: false,
        origin: null,
      }),
    ).rejects.toThrow(/CSRF/i);
  });

  it("rejects upload with cross-origin Origin header", async () => {
    const user = await makeUser("upload-cross-origin@example.com");
    const ms = await makeManuscript(user.id);

    await expect(
      processManuscriptUpload(db!, {
        userId: user.id,
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "thesis.pdf",
        mimeType: "application/pdf",
        stream: makeStream(makePdf(1000)),
        hasXRequestedWith: true,
        origin: "https://evil.example.com",
      }),
    ).rejects.toThrow(/origin/i);
  });

  it("rejects executable renamed to .pdf (magic bytes check)", async () => {
    const user = await makeUser("upload-elf@example.com");
    const ms = await makeManuscript(user.id);

    await expect(
      processManuscriptUpload(db!, {
        userId: user.id,
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "thesis.pdf",
        mimeType: "application/pdf",
        stream: makeStream(makeElf()),
        hasXRequestedWith: true,
        origin: null,
      }),
    ).rejects.toThrow(/PDF magic/i);
  });

  it("rejects HTML renamed to .pdf", async () => {
    const user = await makeUser("upload-html@example.com");
    const ms = await makeManuscript(user.id);

    await expect(
      processManuscriptUpload(db!, {
        userId: user.id,
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "thesis.pdf",
        mimeType: "application/pdf",
        stream: makeStream(makeHtml()),
        hasXRequestedWith: true,
        origin: null,
      }),
    ).rejects.toThrow(/PDF magic/i);
  });

  it("rejects file over 25 MB, cleans up partial file", async () => {
    const user = await makeUser("upload-toobig@example.com");
    const ms = await makeManuscript(user.id);

    const oversized = makePdf(MAX_FILE_BYTES + 1);

    await expect(
      processManuscriptUpload(db!, {
        userId: user.id,
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "big.pdf",
        mimeType: "application/pdf",
        stream: makeStream(oversized),
        hasXRequestedWith: true,
        origin: null,
      }),
    ).rejects.toThrow(/size/i);

    // No file record should have been created in DB
    const files = await db!.manuscriptFile.findMany({ where: { manuscriptId: ms.id } });
    expect(files).toHaveLength(0);
  });

  it("rejects total manuscript size over 100 MB", async () => {
    const user = await makeUser("upload-totalsize@example.com");
    const ms = await makeManuscript(user.id);

    // Seed with a large existing file record (just DB row, no disk file needed for this test)
    await db!.manuscriptFile.create({
      data: {
        manuscriptId: ms.id,
        kind: "SUPPLEMENTARY",
        originalName: "big.pdf",
        storageKey: "aa/bb/fakekeytotalsize1234567890123456",
        mimeType: "application/pdf",
        size: MAX_TOTAL_BYTES - 1000, // just under limit
        sha256: "a".repeat(64),
      },
    });

    await expect(
      processManuscriptUpload(db!, {
        userId: user.id,
        manuscriptId: ms.id,
        kind: "SUPPLEMENTARY",
        originalName: "another.pdf",
        mimeType: "application/pdf",
        stream: makeStream(makePdf(2000)), // 2000 bytes would push total over limit
        hasXRequestedWith: true,
        origin: null,
      }),
    ).rejects.toThrow(/total.*size|100 MB/i);
  });

  it("replacing MANUSCRIPT file removes old file record", async () => {
    const user = await makeUser("upload-replace@example.com");
    const ms = await makeManuscript(user.id);

    // Create first upload
    const first = await processManuscriptUpload(db!, {
      userId: user.id,
      manuscriptId: ms.id,
      kind: "MANUSCRIPT",
      originalName: "v1.pdf",
      mimeType: "application/pdf",
      stream: makeStream(makePdf(2000)),
      hasXRequestedWith: true,
      origin: null,
    });
    expect(first.id).toBeTruthy();

    // Upload a second MANUSCRIPT
    const second = await processManuscriptUpload(db!, {
      userId: user.id,
      manuscriptId: ms.id,
      kind: "MANUSCRIPT",
      originalName: "v2.pdf",
      mimeType: "application/pdf",
      stream: makeStream(makePdf(2000)),
      hasXRequestedWith: true,
      origin: null,
    });

    // Only one MANUSCRIPT file should exist
    const files = await db!.manuscriptFile.findMany({
      where: { manuscriptId: ms.id, kind: "MANUSCRIPT" },
    });
    expect(files).toHaveLength(1);
    expect(files[0]!.id).toBe(second.id);
  });

  it("DELETE: removes file from DB", async () => {
    const user = await makeUser("upload-delete@example.com");
    const ms = await makeManuscript(user.id);

    const uploaded = await processManuscriptUpload(db!, {
      userId: user.id,
      manuscriptId: ms.id,
      kind: "MANUSCRIPT",
      originalName: "doc.pdf",
      mimeType: "application/pdf",
      stream: makeStream(makePdf(2000)),
      hasXRequestedWith: true,
      origin: null,
    });

    await deleteManuscriptFile(db!, { userId: user.id, fileId: uploaded.id });

    const file = await db!.manuscriptFile.findUnique({ where: { id: uploaded.id } });
    expect(file).toBeNull();
  });

  it("DELETE: ownership check - other user's manuscript returns error", async () => {
    const owner = await makeUser("upload-owner@example.com");
    const other = await makeUser("upload-other@example.com");
    const ms = await makeManuscript(owner.id);

    const uploaded = await processManuscriptUpload(db!, {
      userId: owner.id,
      manuscriptId: ms.id,
      kind: "MANUSCRIPT",
      originalName: "doc.pdf",
      mimeType: "application/pdf",
      stream: makeStream(makePdf(2000)),
      hasXRequestedWith: true,
      origin: null,
    });

    await expect(
      deleteManuscriptFile(db!, { userId: other.id, fileId: uploaded.id }),
    ).rejects.toThrow(/not found|forbidden/i);
  });

  it("sha256 of stored file equals sha256 of uploaded bytes (PDF)", async () => {
    const user = await makeUser("upload-sha256-pdf@example.com");
    const ms = await makeManuscript(user.id);
    const pdfBytes = makePdf(4096);
    const expected = (await import("node:crypto")).createHash("sha256").update(pdfBytes).digest("hex");

    const result = await processManuscriptUpload(db!, {
      userId: user.id,
      manuscriptId: ms.id,
      kind: "MANUSCRIPT",
      originalName: "paper.pdf",
      mimeType: "application/pdf",
      stream: makeStream(pdfBytes),
      hasXRequestedWith: true,
      origin: null,
    });

    expect(result.sha256).toBe(expected);
  });

  it("sha256 of stored file equals sha256 of uploaded bytes (DOCX)", async () => {
    const user = await makeUser("upload-sha256-docx@example.com");
    const ms = await makeManuscript(user.id);
    const docxBytes = makeDocx(8192);
    const expected = (await import("node:crypto")).createHash("sha256").update(docxBytes).digest("hex");

    const result = await processManuscriptUpload(db!, {
      userId: user.id,
      manuscriptId: ms.id,
      kind: "MANUSCRIPT",
      originalName: "paper.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      stream: makeStream(docxBytes),
      hasXRequestedWith: true,
      origin: null,
    });

    expect(result.sha256).toBe(expected);
  });

  it("deleteManuscriptFile: rejects delete when manuscript status is SUBMITTED", async () => {
    const user = await makeUser("delete-submitted@example.com");
    const ms = await makeManuscript(user.id, "SUBMITTED");
    // Create a file directly — bypass upload which also blocks SUBMITTED
    const file = await db!.manuscriptFile.create({
      data: {
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "paper.pdf",
        storageKey: "aa/bb/fakestatusguard12345678901234",
        mimeType: "application/pdf",
        size: 1000,
        sha256: "a".repeat(64),
      },
    });

    await expect(
      deleteManuscriptFile(db!, { userId: user.id, fileId: file.id }),
    ).rejects.toThrow(/state/i);
  });

  it("rejects upload when manuscript status is SUBMITTED (not INCOMPLETE/RETURNED_TO_AUTHOR)", async () => {
    const user = await makeUser("upload-submitted@example.com");
    const ms = await makeManuscript(user.id, "SUBMITTED");

    await expect(
      processManuscriptUpload(db!, {
        userId: user.id,
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "doc.pdf",
        mimeType: "application/pdf",
        stream: makeStream(makePdf(2000)),
        hasXRequestedWith: true,
        origin: null,
      }),
    ).rejects.toThrow(/status/i);
  });
});
