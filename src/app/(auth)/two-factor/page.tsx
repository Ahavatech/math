import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AuthShell } from "../auth-shell";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/rbac";
import {
  pendingTwoFactorSecret,
  remainingRecoveryCodes,
  twoFactorRequiredFor,
  twoFactorStatus,
} from "@/server/services/two-factor";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { TwoFactorPanel } from "./two-factor-panel";

export const metadata: Metadata = {
  title: "Two-factor sign-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/login?callbackUrl=/two-factor");

  const { required } = await searchParams;
  const status = await twoFactorStatus(db, user.id);
  const mustHave = env.ADMIN_2FA_REQUIRED === "true" && twoFactorRequiredFor(user.roles);

  const pending =
    status === "pending" ? await pendingTwoFactorSecret(db, user.id, env.AUTH_SECRET, "OAU Mathematics") : null;
  const qr = pending ? await QRCode.toString(pending.uri, { type: "svg", margin: 1, width: 192 }) : null;
  const recoveryLeft = status === "on" ? await remainingRecoveryCodes(db, user.id) : 0;

  return (
    <AuthShell
      title="Two-factor sign-in"
      description={
        required && status !== "on"
          ? "Your role can change the website, so it needs a second step at sign-in. Set it up once here, then carry on to the admin area."
          : "A second step at sign-in: a six-digit code from an app on your phone."
      }
    >
      <TwoFactorPanel
        status={status}
        qrSvg={qr}
        secret={pending?.secret ?? null}
        recoveryLeft={recoveryLeft}
        mustHave={mustHave}
      />
      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-4">
        {status === "on" ? (
          <Link href="/admin" className="link-rule py-2 font-medium">
            Continue to the admin area
          </Link>
        ) : null}
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
