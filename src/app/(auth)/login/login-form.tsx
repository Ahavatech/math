"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ callbackUrl = "" }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  // Controlled, so the email and password survive the form resetting after
  // the first step when a second-factor code is asked for.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const needsCode = state?.needsCode === true;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={needsCode}
          className="h-12 rounded-none text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          maxLength={256}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          readOnly={needsCode}
          className="h-12 rounded-none text-base"
        />
      </div>
      {needsCode ? (
        <div className="space-y-1.5">
          <Label htmlFor="totp">Code from your authenticator app</Label>
          <Input
            id="totp"
            name="totp"
            inputMode="text"
            required
            autoFocus
            autoComplete="one-time-code"
            maxLength={20}
            placeholder="6 digits, or a recovery code"
            className="h-12 rounded-none text-base"
          />
          <p className="text-muted-foreground">
            Lost your phone? Use one of the recovery codes you saved when you turned this on.
          </p>
        </div>
      ) : null}
      {state?.error ? (
        <p className="border-2 border-destructive bg-destructive/5 p-3 text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Signing in..." : needsCode ? "Verify and sign in" : "Sign in"}
      </Button>
      <p className="text-center">
        <Link href="/forgot-password" className="link-rule inline-block py-2 font-medium">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
