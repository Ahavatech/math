"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ callbackUrl = "" }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

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
          className="h-12 rounded-none text-base"
        />
      </div>
      {state?.error ? (
        <p className="border-2 border-destructive bg-destructive/5 p-3 text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
      <p className="text-center">
        <Link href="/forgot-password" className="link-rule inline-block py-2 font-medium">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
