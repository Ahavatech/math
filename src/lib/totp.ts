import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238, HMAC-SHA1, 6 digits, 30 seconds),
 * the scheme every authenticator app speaks. Kept dependency-free so it can
 * be checked against the RFC's own test vectors.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
// Accept the previous and next step as well, to absorb clock drift.
export const TOTP_WINDOW = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function stepFor(timeMs: number): number {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function totpAt(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Checks a code against the secret and returns the step it matched, or null.
 * Steps at or before `lastUsedStep` are refused, so a code (for example one
 * seen over a shoulder) cannot be used a second time.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  options: { now?: number; lastUsedStep?: number | null } = {},
): number | null {
  const cleaned = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return null;
  const current = stepFor(options.now ?? Date.now());
  let matched: number | null = null;
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const step = current + delta;
    if (safeEqual(totpAt(secretBase32, step), cleaned) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (options.lastUsedStep != null && matched <= options.lastUsedStep) return null;
  return matched;
}

export function otpauthUri(params: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.account)}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

// The secret is stored encrypted so a copy of the database alone cannot
// produce sign-in codes. The key comes from AUTH_SECRET, which is not in the
// database.
function encryptionKey(authSecret: string): Buffer {
  return createHash("sha256").update(`oau-maths:totp:${authSecret}`).digest();
}

export function encryptSecret(secret: string, authSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(authSecret), iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string, authSecret: string): string {
  const [iv, tag, body] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(authSecret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** Eight recovery codes shaped like `a1b2-c3d4-e5f6`. */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(6).toString("hex");
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  });
}

export function normaliseRecoveryCode(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-f0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(`recovery:${normaliseRecoveryCode(code)}`).digest("hex");
}
