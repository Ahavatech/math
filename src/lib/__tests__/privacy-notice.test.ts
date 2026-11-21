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

  it("reads as a finished notice: no placeholders, no draft or review wording", () => {
    expect(PRIVACY_NOTICE_BODY).not.toMatch(/placeholder/i);
    expect(PRIVACY_NOTICE_BODY).not.toMatch(/this notice is a|plain-language draft|before launch|needs review|legal review/i);
  });

  it("no longer has the section on outside services that the head of department asked to remove", () => {
    expect(PRIVACY_NOTICE_BODY).not.toContain("Services that help us run the site");
    expect(PRIVACY_NOTICE_BODY).not.toContain("outside Nigeria");
  });

  it("states how long server logs are kept, matching the server's weekly rotation of eight", async () => {
    expect(PRIVACY_NOTICE_BODY).toContain("about eight weeks");
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const logrotate = readFileSync(resolve(__dirname, "../../../deploy/shared-vps/logrotate-oaumaths"), "utf8");
    expect(logrotate).toMatch(/weekly/);
    expect(logrotate).toMatch(/rotate 8\b/);
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
  }, 30_000); // importing the whole sign-in module is slow on a busy machine

  it("never invents department contact details or officer names", () => {
    expect(PRIVACY_NOTICE_BODY).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(PRIVACY_NOTICE_BODY).not.toMatch(/\+?\d[\d\s-]{8,}/);
    // Contact is through the contact page, which the department edits; no officer is named.
    expect(PRIVACY_NOTICE_BODY).toContain('href="/contact"');
  });

  it("has a title", () => {
    expect(PRIVACY_NOTICE_TITLE).toBe("Privacy notice");
  });
});
