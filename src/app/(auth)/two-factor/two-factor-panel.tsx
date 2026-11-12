"use client";

import { useActionState } from "react";
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  startTwoFactorSetupAction,
  type TwoFactorState,
} from "@/server/actions/two-factor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-3 border-2 border-foreground p-4">
      <h2 className="font-heading text-xl font-semibold">Save your recovery codes</h2>
      <p>
        Each code works once if you lose your phone. They are shown only now. Copy them somewhere safe, such as a
        password manager, or print this page.
      </p>
      <ul className="tabular grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-lg">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}

function ErrorLine({ message }: { message?: string }) {
  return message ? (
    <p className="border-2 border-destructive bg-destructive/5 p-3 text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

function PasswordForm({
  action,
  label,
  pendingLabel,
  id,
}: {
  action: (prev: TwoFactorState | undefined, formData: FormData) => Promise<TwoFactorState>;
  label: string;
  pendingLabel: string;
  id: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={id}>Your password</Label>
        <Input
          id={id}
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 rounded-none text-base"
        />
      </div>
      <ErrorLine message={state?.error} />
      {state?.recoveryCodes ? <RecoveryCodes codes={state.recoveryCodes} /> : null}
      {state?.done ? (
        <p className="border-t-2 border-accent pt-3" role="status">
          Done.
        </p>
      ) : null}
      <Button type="submit" variant="outline" className="h-12" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
    </form>
  );
}

export function TwoFactorPanel({
  status,
  qrSvg,
  secret,
  recoveryLeft,
  mustHave,
}: {
  status: "off" | "pending" | "on";
  qrSvg: string | null;
  secret: string | null;
  recoveryLeft: number;
  mustHave: boolean;
}) {
  const [confirmState, confirmAction, confirming] = useActionState(confirmTwoFactorAction, undefined);

  if (confirmState?.recoveryCodes) {
    return (
      <div className="space-y-4">
        <p className="border-t-2 border-accent pt-3 text-lg" role="status">
          Two-factor sign-in is on.
        </p>
        <RecoveryCodes codes={confirmState.recoveryCodes} />
        <p className="text-muted-foreground">
          From now on, signing in asks for a code from your app after your password.
        </p>
      </div>
    );
  }

  if (status === "off") {
    return (
      <div className="space-y-4">
        <p>
          You will need an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or
          Authy. {mustHave ? "This is required for your role." : "This is optional for your role."}
        </p>
        <form action={startTwoFactorSetupAction}>
          <Button type="submit" className="h-12 w-full text-base">
            Set up two-factor sign-in
          </Button>
        </form>
      </div>
    );
  }

  if (status === "pending" && secret && qrSvg) {
    return (
      <div className="space-y-5">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open your authenticator app and add an account by scanning this picture.</li>
          <li>Enter the six-digit code the app shows, then press Turn on.</li>
        </ol>
        <div
          className="inline-block border border-foreground bg-white p-2"
          role="img"
          aria-label="QR code for your authenticator app"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-muted-foreground">
          Cannot scan? Enter this key in the app instead:{" "}
          <span className="tabular font-mono break-all text-foreground">{secret}</span>
        </p>
        <form action={confirmAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="code">Six-digit code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9 ]*"
              required
              autoComplete="one-time-code"
              maxLength={7}
              className="h-12 rounded-none text-base"
            />
          </div>
          <ErrorLine message={confirmState?.error} />
          <Button type="submit" className="h-12 w-full text-base" disabled={confirming}>
            {confirming ? "Checking..." : "Turn on"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="border-t-2 border-accent pt-3 text-lg" role="status">
        Two-factor sign-in is on. You have {recoveryLeft} unused recovery {recoveryLeft === 1 ? "code" : "codes"}.
      </p>
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold">New recovery codes</h2>
        <p className="text-muted-foreground">Makes a fresh set and cancels the old ones.</p>
        <PasswordForm
          id="pw-regenerate"
          action={regenerateRecoveryCodesAction}
          label="Make new recovery codes"
          pendingLabel="Making..."
        />
      </section>
      {mustHave ? (
        <p className="text-muted-foreground">Your role requires two-factor sign-in, so it cannot be turned off.</p>
      ) : (
        <section className="space-y-2">
          <h2 className="font-heading text-xl font-semibold">Turn off</h2>
          <PasswordForm
            id="pw-disable"
            action={disableTwoFactorAction}
            label="Turn off two-factor"
            pendingLabel="Turning off..."
          />
        </section>
      )}
    </div>
  );
}
