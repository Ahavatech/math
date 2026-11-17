import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkBreachedPassword } from "../breached-password";

const sha1 = (value: string) => createHash("sha1").update(value).digest("hex").toUpperCase();

function responder(body: string, status = 200) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(String(url));
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("checkBreachedPassword", () => {
  it("sends only the first five characters of the hash, never the password", async () => {
    const hash = sha1("correct horse battery staple");
    const { fetchImpl, calls } = responder(`${hash.slice(5)}:42\r\n0123456789012345678901234567890ABCDE:0`);
    await checkBreachedPassword("correct horse battery staple", { fetchImpl });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    expect(calls[0]).not.toContain(hash.slice(5));
    expect(calls[0]).not.toContain("horse");
  });

  it("reports a match with its count", async () => {
    const hash = sha1("hunter2hunter2");
    const { fetchImpl } = responder(`AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:3\n${hash.slice(5)}:1234\n`);
    expect(await checkBreachedPassword("hunter2hunter2", { fetchImpl })).toEqual({ breached: true, count: 1234 });
  });

  it("does not treat padding entries (count 0) as a breach", async () => {
    const hash = sha1("a-unique-passphrase-91");
    const { fetchImpl } = responder(`${hash.slice(5)}:0\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:7`);
    expect(await checkBreachedPassword("a-unique-passphrase-91", { fetchImpl })).toEqual({ breached: false, count: 0 });
  });

  it("says not breached when the hash is not in the list", async () => {
    const { fetchImpl } = responder("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC:9");
    expect(await checkBreachedPassword("another-one-here-77", { fetchImpl })).toEqual({ breached: false, count: 0 });
  });

  it("fails open when the service errors, is unreachable or is too slow", async () => {
    expect(await checkBreachedPassword("x-password-12", { fetchImpl: responder("", 503).fetchImpl })).toBeNull();

    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await checkBreachedPassword("x-password-12", { fetchImpl: down })).toBeNull();

    const slow = ((_: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    expect(await checkBreachedPassword("x-password-12", { fetchImpl: slow, timeoutMs: 30 })).toBeNull();
  });
});
