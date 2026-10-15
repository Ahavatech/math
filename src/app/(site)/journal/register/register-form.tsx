"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAuthorAction } from "@/server/actions/author-registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterAuthorForm({
  formToken,
  formRenderedAt,
}: {
  formToken: string;
  formRenderedAt: number;
}) {
  const [state, formAction, pending] = useActionState(registerAuthorAction, undefined);

  if (state?.success) {
    return (
      <div className="mt-6 space-y-3 rounded-md border p-4">
        <p className="font-medium">Check your email</p>
        <p className="text-muted-foreground text-sm">
          We sent a verification link to your email address. Click it to activate your
          account, then sign in to start your submission.
        </p>
        <p className="text-muted-foreground text-sm">
          Already verified?{" "}
          <Link href="/journal/login" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="formRenderedAt" value={formRenderedAt} />
      {/* Honeypot */}
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required maxLength={200} autoComplete="name" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
        <p className="text-muted-foreground text-xs">At least 10 characters.</p>
      </div>

      <div className="flex items-start gap-2">
        <input
          id="privacyConsent"
          name="privacyConsent"
          type="checkbox"
          value="true"
          required
          className="mt-0.5"
        />
        <Label htmlFor="privacyConsent" className="text-sm leading-snug">
          I agree to the{" "}
          <Link href="/journal/policies" className="underline">
            journal policies
          </Link>{" "}
          and the storage of my contact details for correspondence about submissions.
        </Label>
      </div>

      {state?.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/journal/login" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
