import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Department of Mathematics admin and journal access.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
