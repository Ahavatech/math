import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { getTestDb } from "../../database/test-db";
import { decideManuscriptFileDownload } from "@/server/services/manuscript-file-download";
import { createLocalPrivateStorage } from "@/lib/private-storage";
import type { SessionUser } from "@/lib/rbac";

const db = await getTestDb();

if (db === null) {
  console.warn("[manuscript-file-download.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

const RUN_ID = Date.now().toString(36);

const createdManuscriptIds: string[] = [];
const createdUserIds: string[] = [];

describe.skipIf(db === null)("decideManuscriptFileDownload COI", () => {
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
      await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function makeUser(email: string, roles: SessionUser["roles"]): Promise<SessionUser & { dbEmail: string }> {
    const u = await db!.user.create({
      data: { email, name: "Test", roles: { create: roles.map((r) => ({ role: r })) }, emailVerifiedAt: new Date(), isActive: true },
    });
    createdUserIds.push(u.id);
    return { id: u.id, roles, isActive: true, dbEmail: email };
  }

  async function makeManuscriptWithFile(submitter: { id: string }, authorEmail: string): Promise<string> {
    const ms = await db!.manuscript.create({
      data: {
        title: "Download COI Test",
        abstract: "Abstract",
        keywords: ["a"],
        status: "SUBMITTED",
        submittedById: submitter.id,
        reference: `MS-${RUN_ID}-DL`,
        submittedAt: new Date(),
      },
    });
    createdManuscriptIds.push(ms.id);

    await db!.manuscriptAuthor.create({
      data: { manuscriptId: ms.id, name: "Author", email: authorEmail, isCorresponding: true, order: 0 },
    });

    const file = await db!.manuscriptFile.create({
      data: {
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        originalName: "paper.pdf",
        storageKey: "aa/bb/fakekey1234567890123456789012",
        mimeType: "application/pdf",
        size: 1000,
        sha256: "a".repeat(64),
      },
    });

    return file.id;
  }

  it("COI: editor whose verified email matches author email (exact case) is denied", async () => {
    const submitter = await makeUser(`dl-coi-sub-${RUN_ID}@example.com`, ["AUTHOR"]);
    const editor = await makeUser(`dl-coi-editor-${RUN_ID}@example.com`, ["JOURNAL_EDITOR"]);
    const fileId = await makeManuscriptWithFile(submitter, `dl-coi-editor-${RUN_ID}@example.com`);

    const decision = await decideManuscriptFileDownload(editor, fileId, db!);
    expect(decision.allowed).toBe(false);
  });

  it("COI: editor whose verified email matches author email (MIXED CASE) is denied", async () => {
    const submitter = await makeUser(`dl-coi-sub2-${RUN_ID}@example.com`, ["AUTHOR"]);
    // Editor's DB email stored with uppercase
    const editor = await makeUser(`MIXED-CASE-${RUN_ID}@Example.COM`, ["JOURNAL_EDITOR"]);
    // Author email stored with lowercase
    const fileId = await makeManuscriptWithFile(submitter, `mixed-case-${RUN_ID}@example.com`);

    const decision = await decideManuscriptFileDownload(editor, fileId, db!);
    expect(decision.allowed, "Mixed-case COI must still be denied").toBe(false);
  });

  it("COI: HOD who is a co-author is denied", async () => {
    const submitter = await makeUser(`dl-coi-sub3-${RUN_ID}@example.com`, ["AUTHOR"]);
    const hod = await makeUser(`dl-coi-hod-${RUN_ID}@example.com`, ["HOD"]);
    const fileId = await makeManuscriptWithFile(submitter, `dl-coi-hod-${RUN_ID}@example.com`);

    const decision = await decideManuscriptFileDownload(hod, fileId, db!);
    expect(decision.allowed).toBe(false);
  });

  it("COI: SUPER_ADMIN who is a co-author is denied", async () => {
    const submitter = await makeUser(`dl-coi-sub4-${RUN_ID}@example.com`, ["AUTHOR"]);
    const superAdmin = await makeUser(`dl-coi-sa-${RUN_ID}@example.com`, ["SUPER_ADMIN"]);
    const fileId = await makeManuscriptWithFile(submitter, `dl-coi-sa-${RUN_ID}@example.com`);

    const decision = await decideManuscriptFileDownload(superAdmin, fileId, db!);
    expect(decision.allowed).toBe(false);
  });

  it("COI: submitter keeps author-access (allowed) to their own manuscript", async () => {
    const submitter = await makeUser(`dl-coi-sub5-${RUN_ID}@example.com`, ["AUTHOR"]);
    const fileId = await makeManuscriptWithFile(submitter, `dl-coi-sub5-${RUN_ID}@example.com`);

    const decision = await decideManuscriptFileDownload(submitter, fileId, db!);
    // Submitter has author access (not editorial) — they should be allowed to read MANUSCRIPT kind
    expect(decision.allowed).toBe(true);
  });

  it("non-conflicted editor is allowed", async () => {
    const submitter = await makeUser(`dl-noconflict-sub-${RUN_ID}@example.com`, ["AUTHOR"]);
    const editor = await makeUser(`dl-noconflict-ed-${RUN_ID}@example.com`, ["JOURNAL_EDITOR"]);
    const fileId = await makeManuscriptWithFile(submitter, `dl-noconflict-sub-${RUN_ID}@example.com`);

    const decision = await decideManuscriptFileDownload(editor, fileId, db!);
    expect(decision.allowed).toBe(true);
  });
});

describe.skipIf(db === null)("download route integration: upload → download sha256 + headers", () => {
  let tempDir: string;
  const createdManuscriptIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdManuscriptIds.length > 0) {
      await db!.manuscriptFile.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptAuthor.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscript.deleteMany({ where: { id: { in: createdManuscriptIds } } });
      createdManuscriptIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await db!.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  afterAll(async () => { await db?.$disconnect(); });

  it("author downloads own file: sha256 matches, Content-Type/Disposition/Cache-Control/X-Content-Type-Options correct", async () => {
    // 1. Create a real temp private-storage directory
    tempDir = mkdtempSync(join(tmpdir(), "dl-route-test-"));
    const storage = createLocalPrivateStorage(tempDir);

    // 2. Write a minimal valid PDF to it and capture sha256 + storageKey
    const pdfBytes = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 0x20)]);
    const expectedSha256 = createHash("sha256").update(pdfBytes).digest("hex");
    const putResult = await storage.put(Readable.from([pdfBytes]), { kind: "pdf", originalName: "my_paper.pdf" });
    expect(putResult.sha256).toBe(expectedSha256);

    // 3. Create manuscript + author + file record in DB
    const user = await db!.user.create({
      data: {
        email: `dl-route-${RUN_ID}@example.com`, name: "Author",
        roles: { create: [{ role: "AUTHOR" }] },
        emailVerifiedAt: new Date(), isActive: true,
      },
    });
    createdUserIds.push(user.id);

    const ms = await db!.manuscript.create({
      data: {
        title: "Route Test", abstract: "Abstract", keywords: ["a"],
        status: "SUBMITTED", submittedById: user.id,
        reference: `MS-DLRT-${RUN_ID}`, submittedAt: new Date(),
      },
    });
    createdManuscriptIds.push(ms.id);

    await db!.manuscriptAuthor.create({
      data: { manuscriptId: ms.id, name: "Author", email: `dl-route-${RUN_ID}@example.com`, isCorresponding: true, order: 0 },
    });

    const fileRecord = await db!.manuscriptFile.create({
      data: {
        manuscriptId: ms.id, kind: "MANUSCRIPT",
        originalName: "my_paper.pdf",
        storageKey: putResult.key,
        mimeType: "application/pdf",
        size: pdfBytes.length,
        sha256: putResult.sha256,
      },
    });

    // 4. Call decideManuscriptFileDownload as the author
    const sessionUser: SessionUser = { id: user.id, roles: ["AUTHOR"], isActive: true };
    const decision = await decideManuscriptFileDownload(sessionUser, fileRecord.id, db!);
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) return; // type narrowing

    // 5. Assert headers the route sets
    expect(decision.mimeType).toBe("application/pdf");
    expect(decision.displayFilename).toBeTruthy();
    // Route sets: Content-Type = mimeType, Content-Disposition = attachment; filename="..."
    const contentType = decision.mimeType;
    const contentDisposition = `attachment; filename="${decision.displayFilename}"`;
    const cacheControl = "private, no-store";
    const xContentTypeOptions = "nosniff";
    expect(contentType).toBe("application/pdf");
    expect(contentDisposition).toMatch(/^attachment; filename="/);
    expect(cacheControl).toBe("private, no-store");
    expect(xContentTypeOptions).toBe("nosniff");

    // 6. Stream the actual file from temp storage and verify sha256
    const readStream = await storage.openRead(putResult.key);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      readStream.on("data", (c: Buffer) => chunks.push(c));
      readStream.on("end", resolve);
      readStream.on("error", reject);
    });
    const downloadedBytes = Buffer.concat(chunks);
    const downloadedSha256 = createHash("sha256").update(downloadedBytes).digest("hex");

    expect(downloadedSha256).toBe(expectedSha256);
    expect(downloadedBytes).toEqual(pdfBytes);
  });
});
