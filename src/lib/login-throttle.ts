import { loginRateLimiter, loginEmailHourlyRateLimiter, type RateLimiter } from "@/lib/rate-limit";

/**
 * The client address as seen by the proxy in front of the app. Nginx
 * overwrites X-Forwarded-For with the real connecting address (see
 * deploy/nginx), so the first entry cannot be chosen by the visitor there.
 */
export function clientIpFromHeaders(headers: Pick<Headers, "get"> | null | undefined): string {
  const forwardedFor = headers?.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() || "unknown" : "unknown";
}

type LoginLimiters = { perMinute: RateLimiter; perHour: RateLimiter };

const DEFAULT_LIMITERS: LoginLimiters = {
  perMinute: loginRateLimiter,
  perHour: loginEmailHourlyRateLimiter,
};

/**
 * Counts one sign-in attempt and says whether it may proceed. This runs
 * inside the Auth.js credentials check itself, so it covers every way of
 * signing in (the login form and the /api/auth/callback/credentials
 * endpoint), not just the form's server action.
 *
 * Limits: 5 a minute per address, 5 a minute per email, and 20 an hour per
 * email. The state is in memory for one server process; a restart clears it.
 */
export function checkLoginAttempt(
  ip: string,
  email: string,
  limiters: LoginLimiters = DEFAULT_LIMITERS,
): { allowed: boolean } {
  const normalised = email.trim().toLowerCase();
  const ipOk = limiters.perMinute.check(`ip:${ip}`).allowed;
  const emailOk = limiters.perMinute.check(`email:${normalised}`).allowed;
  const hourOk = limiters.perHour.check(`email:${normalised}`).allowed;
  return { allowed: ipOk && emailOk && hourOk };
}
