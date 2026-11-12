"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInviteAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <p className="border-t-2 border-accent pt-3 text-lg" role="status">
          Your password has been set.
        </p>
        <Link
          href="/login"
          className="inline-flex h-12 items-center bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          className="h-12 rounded-none text-base"
        />
      </div>
      {state?.error ? (
        <p className="border-2 border-destructive bg-destructive/5 p-3 text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Setting password..." : "Set password"}
      </Button>
    </form>
  );
}
