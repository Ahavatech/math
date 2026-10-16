import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import React from "react";
import { ReviewerInvitationEmail } from "@/emails/reviewer-invitation";
import { ReviewerReminderEmail } from "@/emails/reviewer-reminder";
import { ReviewerOverdueEmail } from "@/emails/reviewer-overdue";
import { ReviewerAcceptedEmail } from "@/emails/reviewer-accepted";
import { ReviewerDeclinedEmail } from "@/emails/reviewer-declined";
import { ReviewSubmittedEmail } from "@/emails/review-submitted";
import { RevisionReceivedEmail } from "@/emails/revision-received";
import { ReviewerThankYouEmail } from "@/emails/reviewer-thank-you";

const REFERENCE = "OAU-MATH-2026-001";
const JOURNAL = "OAU Journal of Mathematics";
const TITLE = "A Study of Prime Numbers";
const AUTHOR = "John Doe";

describe("reviewer email templates", () => {
  it("invitation email renders with reference and accept/decline links", async () => {
    const html = await render(
      React.createElement(ReviewerInvitationEmail, {
        reference: REFERENCE,
        acceptUrl: "https://example.com/accept/TOKEN",
        declineUrl: "https://example.com/decline/TOKEN",
        dueDays: 21,
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html).toContain("accept");
    expect(html).toContain("decline");
    expect(html).toContain("21");
    // Must NOT contain manuscript title or author name
    expect(html).not.toContain(TITLE);
    expect(html).not.toContain(AUTHOR);
  });

  it("invitation email does not include manuscript title or author identity", async () => {
    const html = await render(
      React.createElement(ReviewerInvitationEmail, {
        reference: REFERENCE,
        acceptUrl: "https://example.com/accept/TOKEN",
        declineUrl: "https://example.com/decline/TOKEN",
        dueDays: 21,
        journalName: JOURNAL,
      }),
    );
    // Reference number only in invitation body
    expect(html).toContain(REFERENCE);
    expect(html).not.toMatch(/prime numbers/i);
    expect(html).not.toMatch(/john doe/i);
  });

  it("reminder email renders with reference and due date", async () => {
    const html = await render(
      React.createElement(ReviewerReminderEmail, {
        reference: REFERENCE,
        reviewUrl: "https://example.com/review/123",
        dueDate: "2026-11-01",
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html).toContain("2026-11-01");
  });

  it("overdue email renders with reference", async () => {
    const html = await render(
      React.createElement(ReviewerOverdueEmail, {
        reference: REFERENCE,
        reviewUrl: "https://example.com/review/123",
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html).toContain("overdue");
  });

  it("reviewer-accepted email renders reference only", async () => {
    const html = await render(
      React.createElement(ReviewerAcceptedEmail, {
        reference: REFERENCE,
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html).not.toContain(TITLE);
  });

  it("reviewer-declined email renders reference only", async () => {
    const html = await render(
      React.createElement(ReviewerDeclinedEmail, {
        reference: REFERENCE,
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html).not.toContain(TITLE);
  });

  it("review-submitted email renders reference and manuscript link", async () => {
    const html = await render(
      React.createElement(ReviewSubmittedEmail, {
        reference: REFERENCE,
        manuscriptUrl: "https://example.com/admin/manuscripts/ms-1",
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html).toContain("ms-1");
  });

  it("revision-received email renders reference and round number", async () => {
    const html = await render(
      React.createElement(RevisionReceivedEmail, {
        reference: REFERENCE,
        round: 2,
        manuscriptUrl: "https://example.com/admin/manuscripts/ms-1",
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html).toContain("2");
  });

  it("reviewer-thank-you email renders reference", async () => {
    const html = await render(
      React.createElement(ReviewerThankYouEmail, {
        reference: REFERENCE,
        journalName: JOURNAL,
      }),
    );
    expect(html).toContain(REFERENCE);
    expect(html.toLowerCase()).toContain("thank you");
  });
});
