import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect("/login");
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="font-heading text-lg font-semibold">Change password</h1>
      <p className="text-sm text-muted-foreground">
        Choose a new password of at least 10 characters. You will need your current password.
      </p>
      <ChangePasswordForm />
    </div>
  );
}
