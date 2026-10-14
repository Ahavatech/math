import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { issueToken, consumeToken } from "@/server/services/tokens";
import { sendVerificationEmail, sendAlreadyRegisteredEmail } from "@/lib/email";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Registers a new author account, or silently handles an already-registered
 * address. Always returns `{ sent: true }` so callers cannot probe whether
 * a given email is registered by comparing response shapes.
 */
export async function registerAuthor(
  db: Db,
  input: { name: string; email: string; passwordPlaintext: string; ip: string },
): Promise<{ sent: true }> {
  const existing = await (db as PrismaClient).user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    await sendAlreadyRegisteredEmail({ to: input.email });
    return { sent: true };
  }

  const passwordHash = await hashPassword(input.passwordPlaintext);
  const user = await (db as PrismaClient).user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      roles: { create: [{ role: "AUTHOR" }] },
    },
  });

  const { token } = await issueToken(db as PrismaClient, user.id, "EMAIL_VERIFY");
  await sendVerificationEmail({ to: input.email, token });

  return { sent: true };
}

/**
 * Consumes an EMAIL_VERIFY token, marks the user's email as verified,
 * and returns the userId. Returns null if the token is invalid, expired,
 * or already used.
 */
export async function verifyEmail(
  db: Db,
  token: string,
): Promise<{ userId: string } | null> {
  const result = await consumeToken(db as PrismaClient, token, "EMAIL_VERIFY");
  if (!result) return null;

  await (db as PrismaClient).user.update({
    where: { id: result.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return { userId: result.userId };
}

/**
 * Validates a `next` redirect parameter to prevent open redirects.
 * Only same-origin relative paths (starts with `/`, not `//`) are allowed.
 * Falls back to `/journal/dashboard`.
 */
export function validateNextParam(next: string | null | undefined): string {
  const fallback = "/journal/dashboard";
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}
