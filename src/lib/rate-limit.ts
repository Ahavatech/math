export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

/**
 * Single-process, in-memory sliding-window rate limiter. Good enough for
 * one Node instance; it does not share state across processes or
 * machines. If the app is ever deployed behind more than one instance,
 * this must be swapped for a shared store (e.g. Redis) behind this same
 * RateLimiter interface — see docs/DECISIONS.md.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: { limit: number; windowMs: number }) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= this.limit) {
      this.hits.set(key, timestamps);
      const retryAfterMs = timestamps[0] + this.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return { allowed: true, retryAfterMs: 0 };
  }
}

// Sign-in attempts are limited in the database instead (src/server/services/login-attempts.ts)
// so the limit survives a restart.
/**
 * The same limit as InMemoryRateLimiter, but counted in the database (see
 * src/server/services/rate-limits.ts) so it survives a restart and is shared
 * by every process. check() is therefore async. Used for the limits that guard
 * password reset, tokens and uploads; the lighter in-memory limiter remains for
 * low-stakes limits such as search.
 */
export class PersistentRateLimiter {
  private readonly name: string;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(options: { name: string; limit: number; windowMs: number }) {
    this.name = options.name;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  async check(key: string): Promise<RateLimitResult> {
    // Loaded on demand so importing this file never needs a database.
    const [{ db }, { checkPersistentLimit }] = await Promise.all([
      import("@/lib/db"),
      import("@/server/services/rate-limits"),
    ]);
    return checkPersistentLimit(db, { name: this.name, key, limit: this.limit, windowMs: this.windowMs });
  }
}

// Shared limiters for the auth flows that need them. Keyed by caller
// (e.g. `${ip}` or `${ip}:${email}`) so IP and per-email limits can be
// checked independently.
export const forgotPasswordRateLimiter = new PersistentRateLimiter({
  name: "forgot-password",
  limit: 3,
  windowMs: 60_000,
});
export const tokenConsumeRateLimiter = new PersistentRateLimiter({
  name: "token-consume",
  limit: 10,
  windowMs: 60_000,
});
export const uploadSigningRateLimiter = new PersistentRateLimiter({
  name: "upload-signing",
  limit: 20,
  windowMs: 60_000,
});
export const cvUploadSigningRateLimiter = new PersistentRateLimiter({
  name: "cv-upload-signing",
  limit: 10,
  windowMs: 60_000,
});
export const changePasswordRateLimiter = new PersistentRateLimiter({
  name: "change-password",
  limit: 5,
  windowMs: 60_000,
});
// Journal author registration: 5 registrations per IP per hour
export const journalRegisterIpRateLimiter = new PersistentRateLimiter({
  name: "journal-register-ip",
  limit: 5,
  windowMs: 60 * 60_000,
});
// Verification token consumption: 3 per IP per hour
export const journalVerifyIpRateLimiter = new PersistentRateLimiter({
  name: "journal-verify-ip",
  limit: 3,
  windowMs: 60 * 60_000,
});
// Resend verification: 3 per email per hour (keyed by email)
export const journalVerifyEmailRateLimiter = new PersistentRateLimiter({
  name: "journal-verify-email",
  limit: 3,
  windowMs: 60 * 60_000,
});
// Manuscript file upload: 30 per user per hour
export const journalUploadRateLimiter = new PersistentRateLimiter({
  name: "journal-upload",
  limit: 30,
  windowMs: 60 * 60_000,
});
