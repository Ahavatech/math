import { describe, expect, it } from "vitest";
import { PRIVACY_NOTICE_BODY, PRIVACY_NOTICE_TITLE } from "../privacy-notice";
import { renderRichText, sanitizeRichText } from "../sanitize-html";

describe("privacy notice text", () => {
  it("survives sanitising unchanged in structure (nothing the page needs is stripped)", () => {
    const clean = sanitizeRichText(PRIVACY_NOTICE_BODY);
    for (const heading of [
      "Contacting us about your information",
      "What we collect, and why",
      "Cookies",
      "Services that help us run the site",
      "How long we keep information",
      "Your rights",
      "How we protect it",
      "Changes to this notice",
    ]) {
      expect(clean, heading).toContain(heading);
    }
    expect(clean).toContain('href="/contact"');
    expect(renderRichText(PRIVACY_NOTICE_BODY).length).toBeGreaterThan(2000);
  });

  it("uses no em dashes (house style) and no script or event handlers", () => {
    expect(PRIVACY_NOTICE_BODY).not.toContain("—");
    expect(PRIVACY_NOTICE_BODY.toLowerCase()).not.toMatch(/<script|onerror=|onclick=|javascript:/);
  });

  it("states the retention periods the site's cleanup jobs actually apply", () => {
    // These mirror scripts/alumni-purge-rejected.ts (90 days), scripts/contact-purge-archived.ts
    // (12 months), scripts/journal-purge-drafts.ts (60 days) and the 14 day backup retention in
    // deploy/backup-scripts/daily-backup.sh. If a job changes, this notice must change with it.
    expect(PRIVACY_NOTICE_BODY).toContain("90 days");
    expect(PRIVACY_NOTICE_BODY).toContain("12 months");
    expect(PRIVACY_NOTICE_BODY).toContain("60 days");
    expect(PRIVACY_NOTICE_BODY).toContain("14 days");
  });

  it("matches the session length the sign-in code uses", async () => {
    const { SESSION_MAX_AGE_SECONDS } = await import("@/auth");
    expect(SESSION_MAX_AGE_SECONDS / 3600).toBe(12);
    expect(PRIVACY_NOTICE_BODY).toContain("up to 12 hours");
  });

  it("never invents department contact details or officer names", () => {
    expect(PRIVACY_NOTICE_BODY).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(PRIVACY_NOTICE_BODY).not.toMatch(/\+?\d[\d\s-]{8,}/);
    expect(PRIVACY_NOTICE_BODY).toContain("[PLACEHOLDER");
  });

  it("has a title", () => {
    expect(PRIVACY_NOTICE_TITLE).toBe("Privacy notice");
  });
});
