import { describe, expect, it, vi } from "vitest";
import { createConfirmToken, verifyConfirmToken } from "../alumni-confirm-token";

const SECRET = "test-secret-value-at-least-16-chars";

describe("alumni-confirm-token", () => {
  it("creates a valid token that verifies and returns the entryId", async () => {
    const token = await createConfirmToken("entry-abc-123", SECRET);
    const result = await verifyConfirmToken(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.entryId).toBe("entry-abc-123");
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await createConfirmToken("entry-xyz", SECRET);
    const result = await verifyConfirmToken(token, "completely-different-secret-val");
    expect(result).toBeNull();
  });

  it("returns null for an expired token (past the 1-hour TTL)", async () => {
    // Create a token, then advance time past TTL
    const token = await createConfirmToken("entry-expired", SECRET);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61 * 60 * 1000);
    const result = await verifyConfirmToken(token, SECRET);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("returns null for a tampered payload (entryId changed)", async () => {
    const token = await createConfirmToken("entry-real", SECRET);
    const parts = token.split(".");
    // Replace the entryId segment with a different cuid
    const fakeId = Buffer.from("entry-fake").toString("base64url");
    parts[1] = fakeId;
    const tampered = parts.join(".");
    const result = await verifyConfirmToken(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for a tampered expiresAt (rolled forward to extend TTL)", async () => {
    const token = await createConfirmToken("entry-ttl-tamper", SECRET);
    const parts = token.split(".");
    // Advance expiry by 24 hours
    parts[2] = String(Number(parts[2]) + 86_400_000);
    const tampered = parts.join(".");
    const result = await verifyConfirmToken(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for a token with too few segments (malformed)", async () => {
    const result = await verifyConfirmToken("one.two.three", SECRET);
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifyConfirmToken("", SECRET);
    expect(result).toBeNull();
  });

  it("returns null for gibberish", async () => {
    const result = await verifyConfirmToken("not.a.real.token", SECRET);
    expect(result).toBeNull();
  });

  it("does not leak expiry vs invalid -- both return null (no oracle)", async () => {
    // Expired token
    const expiredToken = await createConfirmToken("entry-e", SECRET);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61 * 60 * 1000);
    const expiredResult = await verifyConfirmToken(expiredToken, SECRET);
    vi.restoreAllMocks();

    // Invalid token
    const invalidResult = await verifyConfirmToken("not.a.real.token", SECRET);

    // Both return null -- caller cannot distinguish expired from invalid
    expect(expiredResult).toBeNull();
    expect(invalidResult).toBeNull();
  });

  it("two tokens for the same entryId are not identical (nonce randomness)", async () => {
    const t1 = await createConfirmToken("entry-nonce", SECRET);
    const t2 = await createConfirmToken("entry-nonce", SECRET);
    expect(t1).not.toBe(t2);
  });

  it("a valid token cannot be reused once expired", async () => {
    const token = await createConfirmToken("entry-reuse", SECRET);

    // Still valid right after creation
    const first = await verifyConfirmToken(token, SECRET);
    expect(first).not.toBeNull();

    // Advance past TTL
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61 * 60 * 1000);
    const second = await verifyConfirmToken(token, SECRET);
    vi.restoreAllMocks();
    expect(second).toBeNull();
  });
});
