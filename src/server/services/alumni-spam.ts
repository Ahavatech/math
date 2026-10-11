import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

type Db = PrismaClient | Prisma.TransactionClient;

const MIN_FILL_TIME_MS = 4000;

function sign(secret: string, renderedAt: number): string {
  return createHmac("sha256", secret).update(String(renderedAt)).digest("hex");
}

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

export const alumniIpRateLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
export const alumniLinkRateLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

/** True if an AlumniEntry with the same email and graduation year was created in the last 24 hours, any status. */
export async function checkRecentDuplicateSubmission(
  db: Db,
  email: string,
  graduationYear: number,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.alumniEntry.findFirst({
    where: { email, graduationYear, createdAt: { gte: since } },
    select: { id: true },
  });
  return existing !== null;
}
