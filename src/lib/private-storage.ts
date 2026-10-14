import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, chmod, readFile } from "node:fs/promises";
import path from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "./env";

export class PrivateStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateStorageError";
  }
}

export type PrivateFileKind = "pdf" | "docx" | "tex" | "zip";

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25MB

/** Random, server-generated, sharded into two 2-char directory levels. Never derived from user input. */
export function generateStorageKey(): string {
  const raw = randomBytes(32).toString("base64url"); // 43 chars
  return `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
}

/**
 * Resolves a storage key to a real filesystem path, refusing anything
 * that could escape `root`: absolute paths, drive letters, backslashes,
 * null bytes, `..` segments (even after the resolved path is computed -
 * `path.resolve` alone is not enough, since it silently normalizes
 * `a/../../b` without erroring), and a key that isn't the expected
 * two-level-shard shape.
 */
export function resolveStorageKeyPath(root: string, key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new PrivateStorageError("Storage key must be a non-empty string");
  }
  if (key.includes("\u0000")) {
    throw new PrivateStorageError("Storage key must not contain a null byte");
  }
  if (key.includes("\\") || key.includes(":")) {
    throw new PrivateStorageError("Storage key must not contain a backslash or colon");
  }
  if (path.isAbsolute(key) || key.startsWith("/")) {
    throw new PrivateStorageError("Storage key must not be an absolute path");
  }

  const segments = key.split("/");
  if (segments.length !== 3) {
    throw new PrivateStorageError("Storage key must have exactly three segments (shard/shard/name)");
  }
  for (const segment of segments) {
    if (segment.length === 0 || segment === "." || segment === "..") {
      throw new PrivateStorageError("Storage key segments must be non-empty and not . or ..");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
      throw new PrivateStorageError("Storage key segments must be URL-safe base64 characters only");
    }
  }

  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);

  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new PrivateStorageError("Storage key resolves outside the storage root");
  }

  return resolved;
}

const PDF_MAGIC = Buffer.from("%PDF-");
const ZIP_MAGIC_1 = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_MAGIC_2 = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

/**
 * Reads only enough of the temp file to verify its declared kind: magic
 * bytes for PDF and ZIP-based formats, a DOCX-specific search for the
 * `word/document.xml` entry name (zip entry names are stored as plain
 * text in the format, so a raw substring search is sufficient without a
 * full zip parser dependency), and a null-byte check to reject binary
 * data disguised as plain-text TEX.
 */
async function verifyKind(filePath: string, kind: PrivateFileKind): Promise<void> {
  const buffer = await readFile(filePath);

  if (kind === "pdf") {
    if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new PrivateStorageError("File does not start with the PDF magic bytes (%PDF-)");
    }
    return;
  }

  const isZip =
    buffer.subarray(0, 4).equals(ZIP_MAGIC_1) || buffer.subarray(0, 4).equals(ZIP_MAGIC_2);

  if (kind === "zip") {
    if (!isZip) throw new PrivateStorageError("File does not have a valid ZIP signature");
    return;
  }

  if (kind === "docx") {
    if (!isZip) throw new PrivateStorageError("File does not have a valid ZIP signature");
    if (!buffer.includes("word/document.xml")) {
      throw new PrivateStorageError("ZIP file does not contain word/document.xml - not a valid DOCX");
    }
    return;
  }

  if (kind === "tex") {
    if (buffer.includes(0x00)) {
      throw new PrivateStorageError("TEX file must be plain text (contains a null byte)");
    }
    return;
  }

  throw new PrivateStorageError(`Unknown file kind: ${String(kind)}`);
}

export interface PutResult {
  key: string;
  sha256: string;
  size: number;
}

export interface PutOptions {
  kind: PrivateFileKind;
  maxBytes?: number;
  /** Metadata only - sanitised, never used to build a path. */
  originalName?: string;
}

export interface PrivateStorage {
  put(data: Readable, options: PutOptions): Promise<PutResult>;
  openRead(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** Local-disk implementation rooted at `root` (PRIVATE_STORAGE_DIR). */
export function createLocalPrivateStorage(root: string): PrivateStorage {
  const resolvedRoot = path.resolve(root);

  async function put(data: Readable, options: PutOptions): Promise<PutResult> {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const key = generateStorageKey();
    const finalPath = resolveStorageKeyPath(resolvedRoot, key);
    const tempPath = `${finalPath}.${randomBytes(8).toString("hex")}.tmp`;

    await mkdir(path.dirname(finalPath), { recursive: true, mode: 0o700 });

    const hash = createHash("sha256");
    let size = 0;

    try {
      const writeStream = createWriteStream(tempPath, { mode: 0o600 });
      const limiter = new Transform({
        transform(chunk: Buffer, _enc, callback) {
          size += chunk.length;
          if (size > maxBytes) {
            callback(new PrivateStorageError(`File exceeds the maximum allowed size (${maxBytes} bytes)`));
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });

      await pipeline(data, limiter, writeStream);

      await verifyKind(tempPath, options.kind);

      try {
        await chmod(tempPath, 0o600);
      } catch {
        // best-effort on platforms without POSIX permissions (Windows)
      }

      await rename(tempPath, finalPath);
    } catch (err) {
      await rm(tempPath, { force: true });
      throw err instanceof PrivateStorageError
        ? err
        : new PrivateStorageError(err instanceof Error ? err.message : "Failed to store file");
    }

    return { key, sha256: hash.digest("hex"), size };
  }

  async function openRead(key: string): Promise<Readable> {
    const filePath = resolveStorageKeyPath(resolvedRoot, key);
    try {
      await stat(filePath);
    } catch {
      throw new PrivateStorageError("File not found");
    }
    return createReadStream(filePath);
  }

  async function remove(key: string): Promise<void> {
    const filePath = resolveStorageKeyPath(resolvedRoot, key);
    await rm(filePath, { force: true });
  }

  async function exists(key: string): Promise<boolean> {
    const filePath = resolveStorageKeyPath(resolvedRoot, key);
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  return { put, openRead, remove, exists };
}

let defaultStorage: PrivateStorage | null = null;

/** The app-wide storage instance, rooted at env.PRIVATE_STORAGE_DIR (or ./.private-storage in dev). */
export function privateStorage(): PrivateStorage {
  if (!defaultStorage) {
    const root = env.PRIVATE_STORAGE_DIR ?? path.join(process.cwd(), ".private-storage");
    defaultStorage = createLocalPrivateStorage(root);
  }
  return defaultStorage;
}
