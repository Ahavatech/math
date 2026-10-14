import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import {
  createLocalPrivateStorage,
  resolveStorageKeyPath,
  generateStorageKey,
  PrivateStorageError,
} from "../private-storage";

function streamOf(data: Buffer | string): Readable {
  return Readable.from([typeof data === "string" ? Buffer.from(data) : data]);
}

describe("generateStorageKey", () => {
  it("produces a random, sharded two-level key", () => {
    const key = generateStorageKey();
    const parts = key.split("/");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(2);
    expect(parts[1]).toHaveLength(2);
    expect(parts[2].length).toBeGreaterThan(30);
  });

  it("never produces the same key twice across many calls", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateStorageKey()));
    expect(keys.size).toBe(200);
  });
});

describe("resolveStorageKeyPath (hostile input rejection)", () => {
  const root = path.resolve("/tmp/private-storage-root");

  it("resolves a well-formed key inside the root", () => {
    const resolved = resolveStorageKeyPath(root, "ab/cd/efghijklmnop");
    expect(resolved.startsWith(root)).toBe(true);
  });

  for (const hostile of [
    "../../etc/passwd",
    "ab/../../../etc/passwd",
    "/etc/passwd",
    "C:\\Windows\\System32",
    "ab/cd/../../../secret",
    "ab/cd/\u0000null-byte",
    "ab/cd/../../outside",
    "",
    "   ",
    "ab",
    "ab/cd",
    "ab/cd/",
  ]) {
    it(`rejects hostile key ${JSON.stringify(hostile)}`, () => {
      expect(() => resolveStorageKeyPath(root, hostile)).toThrow(PrivateStorageError);
    });
  }
});

describe("createLocalPrivateStorage", () => {
  let root: string;
  let storage: ReturnType<typeof createLocalPrivateStorage>;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "private-storage-test-"));
    storage = createLocalPrivateStorage(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes a PDF, computes sha256 and size, and the file is readable back", async () => {
    const content = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("fake pdf body")]);
    const result = await storage.put(streamOf(content), { kind: "pdf" });

    expect(result.size).toBe(content.length);
    expect(result.sha256).toBe(createHash("sha256").update(content).digest("hex"));
    expect(await storage.exists(result.key)).toBe(true);

    const read = await storage.openRead(result.key);
    const chunks: Buffer[] = [];
    for await (const chunk of read) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).equals(content)).toBe(true);
  });

  it("rejects a file without PDF magic bytes when kind is pdf", async () => {
    await expect(storage.put(streamOf("not a pdf at all"), { kind: "pdf" })).rejects.toThrow(
      PrivateStorageError,
    );
  });

  it("rejects an HTML file masquerading as a PDF (wrong magic bytes, same extension claim)", async () => {
    await expect(
      storage.put(streamOf("<html><script>alert(1)</script></html>"), { kind: "pdf" }),
    ).rejects.toThrow(PrivateStorageError);
  });

  it("accepts a DOCX (zip signature) only when it contains word/document.xml", async () => {
    const realDocx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("word/document.xml some fake zip bytes around it"),
    ]);
    const result = await storage.put(streamOf(realDocx), { kind: "docx" });
    expect(result.size).toBe(realDocx.length);
  });

  it("rejects a zip file claiming to be DOCX but missing word/document.xml", async () => {
    const fakeDocx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("totally different zip contents"),
    ]);
    await expect(storage.put(streamOf(fakeDocx), { kind: "docx" })).rejects.toThrow(
      PrivateStorageError,
    );
  });

  it("accepts a ZIP supplementary file by signature alone", async () => {
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("anything")]);
    const result = await storage.put(streamOf(zip), { kind: "zip" });
    expect(result.size).toBe(zip.length);
  });

  it("rejects an executable (MZ header) disguised as a zip", async () => {
    const exe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.from("this is an exe")]);
    await expect(storage.put(streamOf(exe), { kind: "zip" })).rejects.toThrow(PrivateStorageError);
  });

  it("accepts a plain-text TEX file", async () => {
    const tex = Buffer.from("\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n");
    const result = await storage.put(streamOf(tex), { kind: "tex" });
    expect(result.size).toBe(tex.length);
  });

  it("rejects a binary file disguised as TEX (contains a null byte)", async () => {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    await expect(storage.put(streamOf(binary), { kind: "tex" })).rejects.toThrow(PrivateStorageError);
  });

  it("enforces a maximum size and rejects an oversized upload without writing a partial file", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1000, 0x41)]);
    await expect(storage.put(streamOf(big), { kind: "pdf", maxBytes: 100 })).rejects.toThrow(
      PrivateStorageError,
    );
  });

  it("writes atomically: no stray .tmp files survive a successful put", async () => {
    const content = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("body")]);
    await storage.put(streamOf(content), { kind: "pdf" });

    function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
    }
    const files = walk(root);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("sets restrictive file permissions where the OS supports it", async () => {
    if (process.platform === "win32") return; // chmod is a no-op on Windows
    const content = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("body")]);
    const result = await storage.put(streamOf(content), { kind: "pdf" });
    const filePath = resolveStorageKeyPath(root, result.key);
    const mode = statSync(filePath).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("removes a stored file", async () => {
    const content = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("body")]);
    const result = await storage.put(streamOf(content), { kind: "pdf" });
    expect(await storage.exists(result.key)).toBe(true);
    await storage.remove(result.key);
    expect(await storage.exists(result.key)).toBe(false);
  });

  it("remove is a no-op for a key that does not exist", async () => {
    await expect(storage.remove(generateStorageKey())).resolves.toBeUndefined();
  });

  it("exists returns false for a key that was never written", async () => {
    expect(await storage.exists(generateStorageKey())).toBe(false);
  });

  it("openRead throws for a missing key", async () => {
    await expect(storage.openRead(generateStorageKey())).rejects.toThrow();
  });

  it("put rejects a hostile hint in the original filename without using it as a path", async () => {
    const content = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("body")]);
    const result = await storage.put(streamOf(content), {
      kind: "pdf",
      originalName: "../../../etc/passwd.pdf",
    });
    // the key is still a safe generated key, never derived from the filename
    expect(result.key).not.toContain("..");
    expect(result.key).not.toContain("passwd");
  });
});
