import type { Metadata } from "next";
import { AuthShell } from "../../auth-shell";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = {
  title: "Set your password",
  // A one-time link: keep it out of search results and out of referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell
      title="Set your password"
      description="Choose a password of 10 to 128 characters to finish setting up your account."
    >
      <AcceptInviteForm token={token} />
    </AuthShell>
  );
}
