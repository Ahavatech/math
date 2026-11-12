import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normaliseRecoveryCode,
  otpauthUri,
  stepFor,
  totpAt,
  verifyTotp,
} from "../totp";

// RFC 6238 appendix B: the SHA-1 secret is the ASCII string 12345678901234567890.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 test vectors (last six digits)", () => {
    const vectors: Array<[number, string]> = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
    ];
    for (const [seconds, expected] of vectors) {
      expect(totpAt(RFC_SECRET, stepFor(seconds * 1000))).toBe(expected);
    }
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from("hello world, 12345");
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(() => base32Decode("not*base32")).toThrow();
  });

  it("accepts the current code and one step either side, but not further", () => {
    const now = 1_700_000_000_000;
    const step = stepFor(now);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), { now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 3), { now })).toBeNull();
  });

  it("refuses a step that was already used", () => {
    const now = 1_700_000_000_000;
    const step = stepFor(now);
    const code = totpAt(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, { now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { now, lastUsedStep: step - 1 })).toBe(step);
  });

  it("rejects anything that is not six digits", () => {
    expect(verifyTotp(RFC_SECRET, "12345")).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef")).toBeNull();
    expect(verifyTotp(RFC_SECRET, "")).toBeNull();
  });

  it("encrypts the secret so it is not readable, and only the same key opens it", () => {
    const stored = encryptSecret(RFC_SECRET, "a-long-auth-secret-value-for-testing-0000");
    expect(stored).not.toContain(RFC_SECRET);
    expect(decryptSecret(stored, "a-long-auth-secret-value-for-testing-0000")).toBe(RFC_SECRET);
    expect(() => decryptSecret(stored, "a-different-secret-value-entirely-000000")).toThrow();
  });

  it("builds an otpauth address an authenticator app can read", () => {
    const uri = otpauthUri({ secret: "ABCDEFGH", account: "a@b.com", issuer: "OAU Maths" });
    expect(uri.startsWith("otpauth://totp/OAU%20Maths:a%40b.com?")).toBe(true);
    expect(uri).toContain("secret=ABCDEFGH");
    expect(uri).toContain("period=30");
  });

  it("makes eight distinct recovery codes that hash the same however they are typed", () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(8);
    expect(codes[0]).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);
    expect(hashRecoveryCode(codes[0].toUpperCase())).toBe(hashRecoveryCode(codes[0].replace(/-/g, " ")));
    expect(normaliseRecoveryCode(" AB12-cd34-EF56 ")).toBe("ab12cd34ef56");
  });
});
