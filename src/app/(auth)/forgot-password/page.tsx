import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Forgot your password?</h1>
          <p className="text-muted-foreground text-sm">
            Enter your email and we will send you a reset link if an account
            exists.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
