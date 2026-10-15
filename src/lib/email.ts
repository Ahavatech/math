import "server-only";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { env } from "@/lib/env";
import { InviteEmail } from "@/emails/invite";
import { PasswordResetEmail } from "@/emails/password-reset";
import { AlumniApprovedEmail } from "@/emails/alumni-approved";
import { ContactNotificationEmail } from "@/emails/contact-notification";
import { JournalVerifyEmail } from "@/emails/journal-verify";
import { JournalAlreadyRegisteredEmail } from "@/emails/journal-already-registered";
import { JournalSubmissionReceivedEmail } from "@/emails/journal-submission-received";
import { JournalNewSubmissionEditorsEmail } from "@/emails/journal-new-submission-editors";
import { JournalReturnedToAuthorEmail } from "@/emails/journal-returned-to-author";
import { JournalDecisionAvailableEmail } from "@/emails/journal-decision-available";
import { JournalMovedToReviewEmail } from "@/emails/journal-moved-to-review";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function send(to: string, subject: string, react: React.ReactElement) {
  if (!resend) {
    if (env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required to send email in production");
    }
    const html = await render(react);
    console.log(`\n--- email (console fallback: no RESEND_API_KEY) ---`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(html);
    console.log(`--- end email ---\n`);
    return;
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    react,
  });
}

export async function sendInviteEmail(params: { to: string; name: string; token: string }) {
  const acceptUrl = new URL(
    `/accept-invite/${params.token}`,
    env.AUTH_URL,
  ).toString();

  await send(
    params.to,
    "You have been invited to the OAU Mathematics site",
    InviteEmail({ name: params.name, acceptUrl }),
  );
}

export async function sendPasswordResetEmail(params: { to: string; token: string }) {
  const resetUrl = new URL(
    `/reset-password/${params.token}`,
    env.AUTH_URL,
  ).toString();

  await send(
    params.to,
    "Reset your password",
    PasswordResetEmail({ resetUrl }),
  );
}

export async function sendAlumniApprovedEmail(params: { to: string; name: string; directoryUrl: string; contactUrl: string }) {
  await send(
    params.to,
    "Your entry is now on the department website",
    AlumniApprovedEmail({ name: params.name, directoryUrl: params.directoryUrl, contactUrl: params.contactUrl }),
  );
}

/** Never includes the message body - see src/emails/contact-notification.tsx. */
export async function sendContactNotificationEmail(params: { to: string; senderName: string; type: string; adminUrl: string }) {
  await send(
    params.to,
    "New contact message",
    ContactNotificationEmail({ senderName: params.senderName, type: params.type, adminUrl: params.adminUrl }),
  );
}

export async function sendVerificationEmail(params: { to: string; token: string }) {
  const verifyUrl = new URL(`/journal/verify/${params.token}`, env.AUTH_URL).toString();
  await send(params.to, "Verify your email address", JournalVerifyEmail({ verifyUrl }));
}

export async function sendAlreadyRegisteredEmail(params: { to: string }) {
  const signInUrl = new URL("/journal/login", env.AUTH_URL).toString();
  await send(params.to, "You already have an account", JournalAlreadyRegisteredEmail({ signInUrl }));
}

export async function sendSubmissionReceivedEmail(params: { to: string; reference: string }) {
  const signInUrl = new URL("/journal/dashboard", env.AUTH_URL).toString();
  await send(
    params.to,
    `Submission received: ${params.reference}`,
    JournalSubmissionReceivedEmail({ reference: params.reference, signInUrl }),
  );
}

export async function sendNewSubmissionToEditorsEmail(params: {
  emails: string[];
  reference: string;
  manuscriptUrl: string;
}) {
  await Promise.all(
    params.emails.map((to) =>
      send(
        to,
        `New submission: ${params.reference}`,
        JournalNewSubmissionEditorsEmail({ reference: params.reference, manuscriptUrl: params.manuscriptUrl }),
      ),
    ),
  );
}

export async function sendReturnedToAuthorEmail(params: { to: string; reference: string }) {
  const signInUrl = new URL("/journal/dashboard", env.AUTH_URL).toString();
  await send(
    params.to,
    `Action required: ${params.reference}`,
    JournalReturnedToAuthorEmail({ reference: params.reference, signInUrl }),
  );
}

export async function sendDecisionAvailableEmail(params: { to: string; reference: string }) {
  const signInUrl = new URL("/journal/dashboard", env.AUTH_URL).toString();
  await send(
    params.to,
    `Decision available: ${params.reference}`,
    JournalDecisionAvailableEmail({ reference: params.reference, signInUrl }),
  );
}

export async function sendMovedToReviewEmail(params: { to: string; reference: string }) {
  const signInUrl = new URL("/journal/dashboard", env.AUTH_URL).toString();
  await send(
    params.to,
    `Your submission is in peer review: ${params.reference}`,
    JournalMovedToReviewEmail({ reference: params.reference, signInUrl }),
  );
}
