import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

type Db = PrismaClient | Prisma.TransactionClient;

// The generic honeypot/minimum-fill-time primitives now live in
// src/lib/form-spam.ts, shared with the contact form (Stage 10);
// re-exported here so existing imports of this module keep working.
export { signFormTimestamp, verifyMinFillTime, checkHoneypot } from "@/lib/form-spam";

export const alumniIpRateLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
export const alumniLinkRateLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

/** Separate, tighter limits for the photo upload-signing route (section 5 of the prompt), distinct from the submission limits above. */
export const alumniPhotoSigningIpRateLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
export const alumniPhotoSigningLinkRateLimiter = new InMemoryRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

/** Token lookups (validating a link) get their own, higher-frequency per-IP limit, separate from submission. */
export const alumniTokenLookupRateLimiter = new InMemoryRateLimiter({ limit: 20, windowMs: 60 * 1000 });

/** True if an AlumniEntry with the same normalised email was created in the last 24 hours, any status. */
export async function checkRecentDuplicateSubmission(
  db: Db,
  email: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.alumniEntry.findFirst({
    where: { email: email.trim().toLowerCase(), createdAt: { gte: since } },
    select: { id: true },
  });
  return existing !== null;
}
