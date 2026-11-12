import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "loginAttempt" | "user">;

export const LOGIN_LIMITS = {
  perIpPerMinute: 5,
  perEmailPerMinute: 5,
  perEmailPerHour: 20,
} as const;

// Five failures in half an hour on a real account earns the owner an email.
export const ALERT_AFTER_FAILURES = 5;
export const ALERT_WINDOW_MS = 30 * 60_000;
// ...but never more than one such email an hour.
export const ALERT_COOLDOWN_MS = 60 * 60_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const normalise = (email: string) => email.trim().toLowerCase();

/**
 * Counts one sign-in attempt and says whether it may go ahead. The counts
 * live in the database, so a server restart no longer gives a guesser a
 * fresh allowance, and every process shares them. An attempt that is refused
 * is not counted again.
 */
export async function checkLoginAttempt(
  db: Db,
  ip: string,
  email: string,
  now: Date = new Date(),
): Promise<{ allowed: boolean }> {
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${normalise(email)}`;
  const minuteAgo = new Date(now.getTime() - MINUTE);
  const hourAgo = new Date(now.getTime() - HOUR);

  const [ipCount, emailMinute, emailHour] = await Promise.all([
    db.loginAttempt.count({ where: { key: ipKey, at: { gt: minuteAgo } } }),
    db.loginAttempt.count({ where: { key: emailKey, at: { gt: minuteAgo } } }),
    db.loginAttempt.count({ where: { key: emailKey, at: { gt: hourAgo } } }),
  ]);

  if (
    ipCount >= LOGIN_LIMITS.perIpPerMinute ||
    emailMinute >= LOGIN_LIMITS.perEmailPerMinute ||
    emailHour >= LOGIN_LIMITS.perEmailPerHour
  ) {
    return { allowed: false };
  }

  await db.loginAttempt.createMany({
    data: [
      { key: ipKey, at: now, failed: false },
      { key: emailKey, at: now, failed: true },
    ],
  });

  // Old rows are no use to any limit; tidy up now and then.
  if (Math.random() < 0.02) {
    await db.loginAttempt.deleteMany({ where: { at: { lt: new Date(now.getTime() - 2 * HOUR) } } });
  }
  return { allowed: true };
}

/** A correct sign-in wipes the "failed" mark on that email's recent attempts. */
export async function recordSuccessfulLogin(db: Db, email: string): Promise<void> {
  await db.loginAttempt.updateMany({
    where: { key: `email:${normalise(email)}`, failed: true },
    data: { failed: false },
  });
}

/**
 * After a failed sign-in, says whether the account's owner should now be
 * warned. It returns the user only when the account exists, is active, has
 * had enough recent failures, and has not been warned within the cooldown;
 * it also records that the warning is being sent.
 */
export async function claimFailedLoginAlert(
  db: Db,
  email: string,
  now: Date = new Date(),
): Promise<{ id: string; email: string; name: string; failures: number } | null> {
  const key = `email:${normalise(email)}`;
  const failures = await db.loginAttempt.count({
    where: { key, failed: true, at: { gt: new Date(now.getTime() - ALERT_WINDOW_MS) } },
  });
  if (failures < ALERT_AFTER_FAILURES) return null;

  const user = await db.user.findUnique({
    where: { email: normalise(email) },
    select: { id: true, email: true, name: true, isActive: true, lastFailedAlertAt: true },
  });
  if (!user || !user.isActive) return null;
  if (user.lastFailedAlertAt && now.getTime() - user.lastFailedAlertAt.getTime() < ALERT_COOLDOWN_MS) {
    return null;
  }

  // Only one caller wins if two failures land together.
  const claimed = await db.user.updateMany({
    where: {
      id: user.id,
      OR: [{ lastFailedAlertAt: null }, { lastFailedAlertAt: { lt: new Date(now.getTime() - ALERT_COOLDOWN_MS) } }],
    },
    data: { lastFailedAlertAt: now },
  });
  if (claimed.count === 0) return null;
  return { id: user.id, email: user.email, name: user.name, failures };
}
