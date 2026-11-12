"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, undefined);

  if (state?.message) {
    return (
      <div className="space-y-4">
        <p className="border-t-2 border-accent pt-3 text-lg" role="status">
          {state.message}
        </p>
        <Link href="/login" className="link-rule inline-block py-2 font-medium">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
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
      {state?.error ? (
        <p className="border-2 border-destructive bg-destructive/5 p-3 text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
      </Button>
      <p className="text-center">
        <Link href="/login" className="link-rule inline-block py-2 font-medium">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
