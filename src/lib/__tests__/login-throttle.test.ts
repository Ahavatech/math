import { describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "../rate-limit";
import { checkLoginAttempt, clientIpFromHeaders } from "../login-throttle";

function limiters(overrides: { perMinute?: number; perHour?: number } = {}) {
  return {
    perMinute: new InMemoryRateLimiter({ limit: overrides.perMinute ?? 5, windowMs: 60_000 }),
    perHour: new InMemoryRateLimiter({ limit: overrides.perHour ?? 20, windowMs: 3_600_000 }),
  };
}

describe("clientIpFromHeaders", () => {
  it("takes the first address in x-forwarded-for", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("falls back to 'unknown' without the header or without headers", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
    expect(clientIpFromHeaders(undefined)).toBe("unknown");
    expect(clientIpFromHeaders(null)).toBe("unknown");
  });
});

describe("checkLoginAttempt", () => {
  it("allows five attempts a minute for one address and email, then blocks", () => {
    const l = limiters();
    for (let i = 0; i < 5; i++) {
      expect(checkLoginAttempt("1.1.1.1", "a@example.com", l).allowed).toBe(true);
    }
    expect(checkLoginAttempt("1.1.1.1", "a@example.com", l).allowed).toBe(false);
  });

  it("blocks one email even when every attempt comes from a different address", () => {
    const l = limiters();
    const results = Array.from({ length: 7 }, (_, i) => checkLoginAttempt(`9.9.9.${i}`, "victim@example.com", l).allowed);
    expect(results.slice(0, 5).every(Boolean)).toBe(true);
    expect(results[5]).toBe(false);
    expect(results[6]).toBe(false);
  });

  it("blocks one address that tries many different emails", () => {
    const l = limiters();
    const results = Array.from({ length: 7 }, (_, i) => checkLoginAttempt("8.8.8.8", `user${i}@example.com`, l).allowed);
    expect(results.slice(0, 5).every(Boolean)).toBe(true);
    expect(results[5]).toBe(false);
  });

  it("treats the email case-insensitively so capitals do not buy extra attempts", () => {
    const l = limiters();
    const variants = ["Admin@Example.com", "admin@example.com", "ADMIN@EXAMPLE.COM"];
    const results = Array.from({ length: 8 }, (_, i) => checkLoginAttempt(`7.7.7.${i}`, variants[i % 3], l).allowed);
    expect(results.filter(Boolean).length).toBe(5);
  });

  it("also caps one email per hour, however slowly the attempts arrive", () => {
    const l = limiters({ perMinute: 1000, perHour: 3 });
    const results = Array.from({ length: 5 }, (_, i) => checkLoginAttempt(`6.6.6.${i}`, "slow@example.com", l).allowed);
    expect(results).toEqual([true, true, true, false, false]);
  });
});
