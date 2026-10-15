import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

type Db = PrismaClient | Prisma.TransactionClient;

export { signFormTimestamp, verifyMinFillTime, checkHoneypot } from "@/lib/form-spam";

export const contactIpRateLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

/** True if a ContactMessage with the same email and subject was created in the last hour. */
export async function checkRecentDuplicateContact(
  db: Db,
  email: string,
  subject: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await db.contactMessage.findFirst({
    where: { email, subject, createdAt: { gte: since } },
    select: { id: true },
  });
  return existing !== null;
}
