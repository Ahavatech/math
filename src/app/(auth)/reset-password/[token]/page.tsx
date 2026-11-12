import type { Metadata } from "next";
import { AuthShell } from "../../auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  // A one-time link: keep it out of search results and out of referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell title="Reset your password" description="Choose a new password of 10 to 128 characters.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
