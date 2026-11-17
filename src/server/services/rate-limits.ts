import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "loginAttempt">;

export type PersistentLimitResult = { allowed: boolean; retryAfterMs: number };

/**
 * A sliding-window limit kept in the database, so it survives a restart and
 * is shared by every server process. It uses the same short-lived table as
 * the sign-in limiter (`LoginAttempt`), under a key that starts with `rl:` and
 * names the limit, so different limits never count each other's hits.
 *
 * A refused request is not counted again. Two requests that arrive in the same
 * instant can both be let through; that is acceptable for abuse limits.
 */
export async function checkPersistentLimit(
  db: Db,
  options: { name: string; key: string; limit: number; windowMs: number; now?: Date },
): Promise<PersistentLimitResult> {
  const now = options.now ?? new Date();
  const storedKey = `rl:${options.name}:${options.key}`;
  const since = new Date(now.getTime() - options.windowMs);

  const hits = await db.loginAttempt.findMany({
    where: { key: storedKey, at: { gt: since } },
    select: { at: true },
    orderBy: { at: "asc" },
    take: options.limit,
  });

  if (hits.length >= options.limit) {
    const oldest = hits[0].at.getTime();
    return { allowed: false, retryAfterMs: Math.max(0, oldest + options.windowMs - now.getTime()) };
  }

  await db.loginAttempt.create({ data: { key: storedKey, at: now, failed: false } });

  // Rows older than the longest window anyone uses (one hour) are no use.
  if (Math.random() < 0.02) {
    await db.loginAttempt.deleteMany({ where: { at: { lt: new Date(now.getTime() - 2 * 60 * 60_000) } } });
  }
  return { allowed: true, retryAfterMs: 0 };
}
