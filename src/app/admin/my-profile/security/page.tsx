import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { twoFactorStatus } from "@/server/services/two-factor";
import { signOutEverywhereAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect("/login");
  }
  const twoFactor = await twoFactorStatus(db, user.id);

  return (
    <div className="max-w-xl space-y-10">
      <section className="space-y-4">
        <h1 className="font-heading text-lg font-semibold">Change password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password of at least 10 characters. Avoid common passwords and anything built from your name or
          email; a few unrelated words make a strong one. You will need your current password, and you will be signed
          out on your other devices.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="font-heading text-lg font-semibold">Two-factor sign-in</h2>
        <p className="text-muted-foreground">
          A six-digit code from an app on your phone, asked for after your password.
        </p>
        <p className="flex items-center gap-2">
          <StatusBadge status={twoFactor === "on" ? "ACTIVE" : twoFactor === "pending" ? "PENDING" : "ARCHIVED"} />
          <span>{twoFactor === "on" ? "On" : twoFactor === "pending" ? "Started, not finished" : "Off"}</span>
        </p>
        <Link href="/two-factor" className="link-rule inline-block py-2 font-medium">
          {twoFactor === "on" ? "Manage two-factor sign-in" : "Set up two-factor sign-in"}
        </Link>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="font-heading text-lg font-semibold">Sign out everywhere</h2>
        <p className="text-muted-foreground">
          Ends every session on every device, including this one. Use it if you signed in on a shared computer or think
          someone else may have your session.
        </p>
        <form action={signOutEverywhereAction}>
          <Button type="submit" variant="outline">
            Sign out on all devices
          </Button>
        </form>
      </section>
    </div>
  );
}
