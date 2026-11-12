import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "revokedSession">;

/**
 * Ends one session on the server. The token's jti goes on a list that every
 * later request checks, so a copy of the cookie that someone already stole
 * stops working at once instead of at its natural expiry. The row only needs
 * to live as long as the token could have, so it carries the same expiry.
 */
export async function revokeSession(
  db: Db,
  session: { jti: string; userId: string; expiresAt: Date },
): Promise<void> {
  await db.revokedSession.upsert({
    where: { jti: session.jti },
    create: { jti: session.jti, userId: session.userId, expiresAt: session.expiresAt },
    update: {},
  });
}

export async function isSessionRevoked(db: Db, jti: string | undefined | null): Promise<boolean> {
  // A token with no jti predates revocation; it can only live out its 12 hours.
  if (!jti) return false;
  const row = await db.revokedSession.findUnique({ where: { jti }, select: { jti: true } });
  return row !== null;
}

/** Removes entries whose token has expired anyway. Safe to call at any time. */
export async function purgeExpiredRevocations(db: Db, now: Date = new Date()): Promise<number> {
  const { count } = await db.revokedSession.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}
