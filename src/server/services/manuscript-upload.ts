import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { Readable } from "node:stream";
import { privateStorage } from "@/lib/private-storage";
import type { PrivateFileKind } from "@/lib/private-storage";

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_FILE_COUNT = 10;

const UPLOADABLE_STATUSES = new Set(["INCOMPLETE", "RETURNED_TO_AUTHOR"]);

/** Allowed ManuscriptFileKind → PrivateFileKind mapping */
const KIND_TO_STORAGE: Record<string, PrivateFileKind> = {
  MANUSCRIPT: "pdf",
  TITLE_PAGE: "pdf",
  SUPPLEMENTARY: "pdf",
  RESPONSE_TO_REVIEWERS: "pdf",
  REVISED: "pdf",
  COPYEDITED: "pdf",
};

// DOCX uploads use "docx" kind — caller passes kind MANUSCRIPT with mimeType docx
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Sanitise a user-supplied filename: strip path separators, collapse any
 * extension except the last one (prevents double-extension attacks like
 * `malware.exe.pdf`), replace remaining dots with underscores.
 */
export function sanitiseFilename(raw: string): string {
  // Strip all path separators and null bytes
  let name = raw.replace(/[/\\:\0]/g, "_");
  // Strip leading dots (hidden files)
  name = name.replace(/^\.+/, "");
  // Split on dots
  const parts = name.split(".");
  if (parts.length <= 1) return name || "file";
  const ext = parts.pop()!;
  // Flatten middle parts (any extra extensions → replace dots with underscores)
  const stem = parts.join("_").replace(/\s+/g, "_");
  return `${stem || "file"}.${ext}`;
}

/**
 * Given the raw bytes of a docProps/core.xml (or null if not found),
 * return a warning string if the creator or lastModifiedBy fields are
 * non-empty, or null if clean.
 */
export async function extractDocxMetadataWarning(
  coreXmlBytes: Buffer | null,
): Promise<string | null> {
  if (!coreXmlBytes) return null;
  const xml = coreXmlBytes.toString("utf-8");

  const creator = extractXmlText(xml, "dc:creator");
  const lastModifiedBy = extractXmlText(xml, "cp:lastModifiedBy");

  const fields: string[] = [];
  if (creator) fields.push(`creator: "${creator}"`);
  if (lastModifiedBy) fields.push(`lastModifiedBy: "${lastModifiedBy}"`);

  if (fields.length === 0) return null;
  return `Document metadata may reveal author identity (${fields.join(", ")}). Please clear document properties before submitting.`;
}

function extractXmlText(xml: string, tag: string): string {
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const startTag = xml.indexOf(open);
  if (startTag === -1) return "";
  const closeAngle = xml.indexOf(">", startTag);
  if (closeAngle === -1) return "";
  // self-closing?
  if (xml[closeAngle - 1] === "/") return "";
  const closeTag = xml.indexOf(close, closeAngle);
  if (closeTag === -1) return "";
  return xml.slice(closeAngle + 1, closeTag).trim();
}

/**
 * Read only the first 64 KB of the zip-format buffer looking for
 * `docProps/core.xml`, then extract its content without a full zip
 * parser dependency.
 */
function extractCoreXmlFromDocx(fileBuffer: Buffer): Buffer | null {
  const MAX_SCAN = Math.min(fileBuffer.length, 64 * 1024);
  const scan = fileBuffer.subarray(0, MAX_SCAN);
  const entryName = Buffer.from("docProps/core.xml");
  const idx = scan.indexOf(entryName);
  if (idx === -1) return null;

  // The local file header stores the compressed size at offset 18 and
  // uncompressed size at offset 22 from the start of the header (PK\x03\x04).
  // Walk backwards to find the local file header for this entry.
  // Local file header signature: 50 4b 03 04
  const SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  let headerStart = idx;
  while (headerStart > 0) {
    headerStart--;
    if (fileBuffer.subarray(headerStart, headerStart + 4).equals(SIG)) break;
  }
  if (!fileBuffer.subarray(headerStart, headerStart + 4).equals(SIG)) return null;

  const compressionMethod = fileBuffer.readUInt16LE(headerStart + 8);
  const compressedSize = fileBuffer.readUInt32LE(headerStart + 18);
  const filenameLength = fileBuffer.readUInt16LE(headerStart + 26);
  const extraLength = fileBuffer.readUInt16LE(headerStart + 28);
  const dataStart = headerStart + 30 + filenameLength + extraLength;

  if (compressionMethod !== 0) return null; // Only handle stored (uncompressed) entries
  if (dataStart + compressedSize > fileBuffer.length) return null;

  return fileBuffer.subarray(dataStart, dataStart + compressedSize);
}

export interface UploadInput {
  userId: string;
  manuscriptId: string;
  kind: string;
  originalName: string;
  mimeType: string;
  stream: Readable;
  hasXRequestedWith: boolean;
  /** Null means no Origin header was sent (same-origin is allowed) */
  origin: string | null;
  allowedOrigins?: string[];
}

export interface UploadResult {
  id: string;
  size: number;
  sha256: string;
  metadataWarning: string | null;
}

/**
 * Validate, store, and record a manuscript file upload.
 *
 * CSRF check: requires X-Requested-With: fetch AND (no Origin header OR
 * Origin matching the deployment origin).
 */
export async function processManuscriptUpload(
  db: PrismaClient,
  input: UploadInput,
): Promise<UploadResult> {
  // --- CSRF check ---
  if (!input.hasXRequestedWith) {
    throw new Error("CSRF check failed: X-Requested-With header required");
  }

  if (input.origin !== null && input.origin !== "") {
    const allowed = input.allowedOrigins ?? [];
    if (!allowed.includes(input.origin)) {
      throw new Error(`CSRF check failed: cross-origin request from ${input.origin}`);
    }
  }

  // --- Ownership and status check ---
  const ms = await db.manuscript.findUnique({
    where: { id: input.manuscriptId },
    select: { submittedById: true, status: true },
  });
  if (!ms || ms.submittedById !== input.userId) {
    throw new Error("Manuscript not found");
  }
  if (!UPLOADABLE_STATUSES.has(ms.status)) {
    throw new Error(`Cannot upload files to a manuscript with status ${ms.status}`);
  }

  // --- Total size cap check (pre-upload) ---
  const existing = await db.manuscriptFile.findMany({
    where: { manuscriptId: input.manuscriptId },
    select: { id: true, kind: true, size: true, storageKey: true },
  });
  if (existing.length >= MAX_FILE_COUNT) {
    throw new Error(`Maximum ${MAX_FILE_COUNT} files per manuscript`);
  }
  const existingTotal = existing.reduce((sum, f) => sum + f.size, 0);
  // Note: we check remaining capacity — if even an empty new file would
  // exceed the total, reject immediately. Actual bytes checked mid-stream.
  if (existingTotal >= MAX_TOTAL_BYTES) {
    throw new Error(`Total manuscript size exceeds 100 MB`);
  }

  // --- Determine storage kind ---
  const isDocx =
    input.mimeType === DOCX_MIME ||
    input.originalName.toLowerCase().endsWith(".docx");
  const storageKind: PrivateFileKind = isDocx
    ? "docx"
    : (KIND_TO_STORAGE[input.kind] ?? "pdf");

  // --- Store file (magic bytes verified inside put()) ---
  const storage = privateStorage();
  const putResult = await storage.put(input.stream, {
    kind: storageKind,
    maxBytes: MAX_FILE_BYTES,
    originalName: sanitiseFilename(input.originalName),
  });

  // --- Check total size after upload ---
  if (existingTotal + putResult.size > MAX_TOTAL_BYTES) {
    // Remove what we just wrote then reject
    await storage.remove(putResult.key).catch(() => {});
    throw new Error(`Total manuscript size would exceed 100 MB`);
  }

  // --- DOCX metadata warning ---
  let metadataWarning: string | null = null;
  if (input.kind === "MANUSCRIPT" && isDocx) {
    try {
      const fullBuffer = await readStorageBuffer(storage, putResult.key);
      const coreXml = extractCoreXmlFromDocx(fullBuffer);
      metadataWarning = await extractDocxMetadataWarning(coreXml);
    } catch {
      // Best-effort: never fail upload over metadata warning extraction
    }
  }

  // --- Replace existing MANUSCRIPT file (only one allowed) ---
  let replacedKey: string | null = null;
  if (input.kind === "MANUSCRIPT") {
    const existingManuscript = existing.find((f) => f.kind === "MANUSCRIPT");
    if (existingManuscript) {
      replacedKey = existingManuscript.storageKey;
      await db.manuscriptFile.delete({ where: { id: existingManuscript.id } });
    }
  }

  // --- Persist file record ---
  const sanitised = sanitiseFilename(input.originalName);
  const file = await db.manuscriptFile.create({
    data: {
      manuscriptId: input.manuscriptId,
      kind: input.kind as import("@prisma/client").ManuscriptFileKind,
      originalName: sanitised,
      storageKey: putResult.key,
      mimeType: input.mimeType,
      size: putResult.size,
      sha256: putResult.sha256,
      uploadedById: input.userId,
    },
  });

  // Remove old file from disk after DB record updated
  if (replacedKey) {
    await storage.remove(replacedKey).catch(() => {});
  }

  return { id: file.id, size: putResult.size, sha256: putResult.sha256, metadataWarning };
}

async function readStorageBuffer(
  storage: ReturnType<typeof privateStorage>,
  key: string,
): Promise<Buffer> {
  const stream = await storage.openRead(key);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function deleteManuscriptFile(
  db: PrismaClient,
  input: { userId: string; fileId: string },
): Promise<void> {
  const file = await db.manuscriptFile.findUnique({
    where: { id: input.fileId },
    select: { id: true, storageKey: true, manuscript: { select: { submittedById: true, status: true } } },
  });

  if (!file || file.manuscript.submittedById !== input.userId) {
    throw new Error("File not found or forbidden");
  }

  if (!UPLOADABLE_STATUSES.has(file.manuscript.status)) {
    throw new Error("Cannot delete files from a manuscript in this state");
  }

  await db.manuscriptFile.delete({ where: { id: file.id } });
  const storage = privateStorage();
  await storage.remove(file.storageKey).catch(() => {});
}
