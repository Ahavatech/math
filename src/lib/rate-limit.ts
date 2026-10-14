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

// Shared limiters for the auth flows that need them. Keyed by caller
// (e.g. `${ip}` or `${ip}:${email}`) so IP and per-email limits can be
// checked independently.
export const loginRateLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60_000 });
export const forgotPasswordRateLimiter = new InMemoryRateLimiter({
  limit: 3,
  windowMs: 60_000,
});
export const tokenConsumeRateLimiter = new InMemoryRateLimiter({
  limit: 10,
  windowMs: 60_000,
});
export const uploadSigningRateLimiter = new InMemoryRateLimiter({
  limit: 20,
  windowMs: 60_000,
});
export const cvUploadSigningRateLimiter = new InMemoryRateLimiter({
  limit: 10,
  windowMs: 60_000,
});
export const changePasswordRateLimiter = new InMemoryRateLimiter({
  limit: 5,
  windowMs: 60_000,
});
// Journal author registration: 5 registrations per IP per hour
export const journalRegisterIpRateLimiter = new InMemoryRateLimiter({
  limit: 5,
  windowMs: 60 * 60_000,
});
// Verification token consumption: 3 per IP per hour
export const journalVerifyIpRateLimiter = new InMemoryRateLimiter({
  limit: 3,
  windowMs: 60 * 60_000,
});
// Resend verification: 3 per email per hour (keyed by email)
export const journalVerifyEmailRateLimiter = new InMemoryRateLimiter({
  limit: 3,
  windowMs: 60 * 60_000,
});
// Manuscript file upload: 30 per user per hour
export const journalUploadRateLimiter = new InMemoryRateLimiter({
  limit: 30,
  windowMs: 60 * 60_000,
});
