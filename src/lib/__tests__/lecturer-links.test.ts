import { describe, expect, it } from "vitest";
import { isAllowedProfileUrl, isValidOrcid } from "../lecturer-links";

describe("isAllowedProfileUrl", () => {
  it("accepts an https URL on the allowed host for that field", () => {
    expect(isAllowedProfileUrl("https://scholar.google.com/citations?user=abc", "scholar")).toBe(true);
    expect(isAllowedProfileUrl("https://orcid.org/0000-0001-2345-6789", "orcid")).toBe(true);
    expect(isAllowedProfileUrl("https://www.researchgate.net/profile/X", "researchGate")).toBe(true);
    expect(isAllowedProfileUrl("https://www.linkedin.com/in/x", "linkedin")).toBe(true);
  });

  it("rejects a mismatched host", () => {
    expect(isAllowedProfileUrl("https://evil.example/scholar.google.com", "scholar")).toBe(false);
    expect(isAllowedProfileUrl("https://linkedin.com.evil.example", "linkedin")).toBe(false);
  });

  it("rejects http (non-https)", () => {
    expect(isAllowedProfileUrl("http://scholar.google.com/x", "scholar")).toBe(false);
  });

  it("rejects javascript: and data: URLs", () => {
    expect(isAllowedProfileUrl("javascript:alert(1)", "scholar")).toBe(false);
    expect(isAllowedProfileUrl("data:text/html,<script>alert(1)</script>", "linkedin")).toBe(false);
  });

  it("rejects an unparsable string", () => {
    expect(isAllowedProfileUrl("not a url", "orcid")).toBe(false);
  });
});

describe("isValidOrcid", () => {
  it("accepts a correctly formatted ORCID with a valid checksum", () => {
    // 0000-0002-1825-0097 is ORCID's own published example id.
    expect(isValidOrcid("0000-0002-1825-0097")).toBe(true);
  });

  it("accepts an ORCID ending in X", () => {
    // 0000-0002-1694-233X is another published example id.
    expect(isValidOrcid("0000-0002-1694-233X")).toBe(true);
  });

  it("rejects the wrong shape", () => {
    expect(isValidOrcid("0000-0002-1825-009")).toBe(false);
    expect(isValidOrcid("00000002-1825-0097")).toBe(false);
    expect(isValidOrcid("not-an-orcid")).toBe(false);
  });

  it("rejects a bad checksum", () => {
    expect(isValidOrcid("0000-0002-1825-0098")).toBe(false);
  });
});
