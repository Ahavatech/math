import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, dummyHash } from "../password";

describe("password", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword(hash, "correct-horse-battery")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("produces an argon2id hash distinct from the plaintext", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toBe("correct-horse-battery");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("dummyHash resolves to false without throwing, for login timing parity", async () => {
    await expect(verifyPassword(dummyHash, "anything")).resolves.toBe(false);
  });
});
