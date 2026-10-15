import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";

const FORBIDDEN = [
  "Manuscript title",
  "Author Name",
  "cover letter",
  "Dear Author",
  "abstract",
  // em dash
  "—",
];

describe("journal email templates", () => {
  it("journal-verify: renders verification link, no forbidden strings", async () => {
    const { JournalVerifyEmail } = await import("@/emails/journal-verify");
    const html = await render(JournalVerifyEmail({ verifyUrl: "https://example.com/journal/verify/TOKEN123" }));
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("TOKEN123");
  });

  it("journal-already-registered: renders sign-in link, no forbidden strings", async () => {
    const { JournalAlreadyRegisteredEmail } = await import("@/emails/journal-already-registered");
    const html = await render(JournalAlreadyRegisteredEmail({ signInUrl: "https://example.com/journal/login" }));
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("journal/login");
  });

  it("journal-submission-received: renders reference, no forbidden strings", async () => {
    const { JournalSubmissionReceivedEmail } = await import("@/emails/journal-submission-received");
    const html = await render(
      JournalSubmissionReceivedEmail({
        reference: "MS-2026-0001",
        signInUrl: "https://example.com/journal/dashboard",
      }),
    );
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("MS-2026-0001");
  });

  it("journal-new-submission-editors: renders reference and manuscript URL, no forbidden strings", async () => {
    const { JournalNewSubmissionEditorsEmail } = await import("@/emails/journal-new-submission-editors");
    const html = await render(
      JournalNewSubmissionEditorsEmail({
        reference: "MS-2026-0002",
        manuscriptUrl: "https://example.com/admin/journal/manuscripts/abc123",
      }),
    );
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("MS-2026-0002");
    expect(html).toContain("abc123");
  });

  it("journal-returned-to-author: renders reference and sign-in link, no forbidden strings", async () => {
    const { JournalReturnedToAuthorEmail } = await import("@/emails/journal-returned-to-author");
    const html = await render(
      JournalReturnedToAuthorEmail({
        reference: "MS-2026-0003",
        signInUrl: "https://example.com/journal/dashboard",
      }),
    );
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("MS-2026-0003");
  });

  it("journal-decision-available: renders reference and sign-in link, no forbidden strings", async () => {
    const { JournalDecisionAvailableEmail } = await import("@/emails/journal-decision-available");
    const html = await render(
      JournalDecisionAvailableEmail({
        reference: "MS-2026-0004",
        signInUrl: "https://example.com/journal/dashboard",
      }),
    );
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("MS-2026-0004");
  });

  it("journal-moved-to-review: renders reference and sign-in link, no forbidden strings", async () => {
    const { JournalMovedToReviewEmail } = await import("@/emails/journal-moved-to-review");
    const html = await render(
      JournalMovedToReviewEmail({
        reference: "MS-2026-0005",
        signInUrl: "https://example.com/journal/dashboard",
      }),
    );
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("MS-2026-0005");
  });
});
