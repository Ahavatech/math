import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Set your password</h1>
          <p className="text-muted-foreground text-sm">
            Choose a password of at least 10 characters to finish setting up
            your account.
          </p>
        </div>
        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}
