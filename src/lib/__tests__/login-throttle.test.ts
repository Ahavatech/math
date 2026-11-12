import { describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "../login-throttle";

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
