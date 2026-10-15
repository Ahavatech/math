import { describe, expect, it } from "vitest";
import { isHttpsUrl } from "../url-validation";

describe("isHttpsUrl", () => {
  it("accepts a well-formed https URL", () => {
    expect(isHttpsUrl("https://example.com/register")).toBe(true);
  });

  it("rejects http", () => {
    expect(isHttpsUrl("http://example.com")).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(isHttpsUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isHttpsUrl("not a url")).toBe(false);
    expect(isHttpsUrl("")).toBe(false);
  });
});
