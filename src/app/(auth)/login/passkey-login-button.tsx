"use client";

import { useState, useSyncExternalStore } from "react";
import { KeyRound } from "lucide-react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { passkeyLoginAction, passkeyLoginOptionsAction } from "@/server/actions/passkeys";
import { Button } from "@/components/ui/button";

/**
 * "Sign in with a passkey": the device asks for a fingerprint, face or PIN, so
 * there is no password to type, steal or phish. Shown only where the browser
 * supports passkeys.
 */
export function PasskeyLoginButton({ callbackUrl = "" }: { callbackUrl?: string }) {
  // Asked of the browser, so false while rendering on the server.
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => browserSupportsWebAuthn(),
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supported) return null;

  async function signInWithPasskey() {
    setBusy(true);
    setError(null);
    try {
      const prepared = await passkeyLoginOptionsAction();
      if ("error" in prepared) {
        setError(prepared.error);
        return;
      }
      const response = await startAuthentication({ optionsJSON: prepared.options });
      // On success this navigates away; it only returns when something went wrong.
      const result = await passkeyLoginAction({ challengeId: prepared.challengeId, response, callbackUrl });
      if (result?.error) setError(result.error);
    } catch (caught) {
      const name = caught instanceof Error ? caught.name : "";
      // Closing the device prompt is not an error worth shouting about.
      setError(
        name === "NotAllowedError" || name === "AbortError"
          ? "The passkey prompt was closed. Try again when you are ready."
          : "Could not use a passkey on this device. Sign in with your password instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={signInWithPasskey} disabled={busy}>
        <KeyRound aria-hidden="true" />
        {busy ? "Waiting for your device..." : "Sign in with a passkey"}
      </Button>
      {error ? (
        <p className="border-2 border-destructive bg-destructive/5 p-3 text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
