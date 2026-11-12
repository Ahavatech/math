import type { Metadata } from "next";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Passed to the form only if it is a safe place to send someone after
  // signing in; the sign-in action checks it again.
  const returnTo = safeCallbackPath(callbackUrl) ?? "";

  return (
    <AuthShell title="Sign in" description="Admin and journal access for the Department of Mathematics.">
      <LoginForm callbackUrl={returnTo} />
    </AuthShell>
  );
}
