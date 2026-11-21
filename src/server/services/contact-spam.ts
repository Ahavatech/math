import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { PersistentRateLimiter } from "@/lib/rate-limit";

type Db = PrismaClient | Prisma.TransactionClient;

export { signFormTimestamp, verifyMinFillTime, checkHoneypot } from "@/lib/form-spam";

/** Contact messages: 5 an hour per address, counted in the database so a restart does not reset it. */
export const CONTACT_IP_LIMIT = { name: "contact-ip", limit: 5, windowMs: 60 * 60 * 1000 };
export const contactIpRateLimiter = new PersistentRateLimiter(CONTACT_IP_LIMIT);

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
