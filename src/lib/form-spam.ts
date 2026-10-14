import { createHmac, timingSafeEqual } from "node:crypto";

const MIN_FILL_TIME_MS = 4000;

function sign(secret: string, renderedAt: number): string {
  return createHmac("sha256", secret).update(String(renderedAt)).digest("hex");
}

/**
 * Generic, form-agnostic spam primitives shared by every public form that
 * needs a honeypot and a minimum-fill-time check without a CAPTCHA
 * (first built for the alumni submission form, DECISIONS.md #46 - moved
 * here once a second form, the contact form, needed the exact same
 * checks, to avoid two copies of the HMAC logic drifting apart).
 */

/** Called when rendering the form: returns a timestamp and an HMAC over it, both embedded as hidden fields. */
export function signFormTimestamp(secret: string): { formToken: string; formRenderedAt: number } {
  const formRenderedAt = Date.now();
  return { formToken: sign(secret, formRenderedAt), formRenderedAt };
}

/**
 * Recomputes the HMAC over the submitted `formRenderedAt` rather than
 * trusting it: a client cannot shift the apparent elapsed time by
 * editing the hidden `formRenderedAt` field alone, since the token
 * would then no longer match. Also enforces the minimum fill time
 * itself (default 4 seconds) against the server's own clock.
 */
export function verifyMinFillTime(
  formToken: string,
  formRenderedAt: number,
  secret: string,
  minMs: number = MIN_FILL_TIME_MS,
): boolean {
  const expected = sign(secret, formRenderedAt);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(formToken, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return false;
  }
  return Date.now() - formRenderedAt >= minMs;
}

export function checkHoneypot(value: string): boolean {
  return value === "";
}
