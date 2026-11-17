"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import {
  finishPasskeyRegistrationAction,
  removePasskeyAction,
  startPasskeyRegistrationAction,
} from "@/server/actions/passkeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SavedMark } from "@/components/ui/saved-mark";

export type PasskeyListItem = { id: string; deviceName: string; createdAt: string; lastUsedAt: string | null };

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

function PasskeyRow({ passkey }: { passkey: PasskeyListItem }) {
  const [state, action, pending] = useActionState(removePasskeyAction, undefined);
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{passkey.deviceName}</p>
        <p className="text-muted-foreground">
          Added {when(passkey.createdAt)}
          {passkey.lastUsedAt ? `, last used ${when(passkey.lastUsedAt)}` : ", not used yet"}
        </p>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={passkey.id} />
        <div className="space-y-1">
          <Label htmlFor={`remove-${passkey.id}`}>Your password, to remove it</Label>
          <Input id={`remove-${passkey.id}`} name="password" type="password" required autoComplete="current-password" className="w-60" />
        </div>
        <Button type="submit" variant="outline" disabled={pending} aria-label={`Remove passkey: ${passkey.deviceName}`}>
          {pending ? "Removing..." : "Remove"}
        </Button>
      </form>
      {state?.error ? (
        <p className="text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </li>
  );
}

/** The passkeys a person has, and a way to add one. */
export function PasskeysPanel({ passkeys }: { passkeys: PasskeyListItem[] }) {
  const router = useRouter();
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => browserSupportsWebAuthn(),
    () => true,
  );
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  async function add() {
    setBusy(true);
    setError(null);
    setAdded(false);
    try {
      const prepared = await startPasskeyRegistrationAction();
      if ("error" in prepared) {
        setError(prepared.error);
        return;
      }
      const response = await startRegistration({ optionsJSON: prepared.options });
      const result = await finishPasskeyRegistrationAction({
        challengeId: prepared.challengeId,
        response,
        deviceName,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setAdded(true);
      setDeviceName("");
      router.refresh();
    } catch (caught) {
      const name = caught instanceof Error ? caught.name : "";
      setError(
        name === "NotAllowedError" || name === "AbortError"
          ? "The prompt was closed before the passkey was saved."
          : name === "InvalidStateError"
            ? "This device already has a passkey for your account."
            : "Could not create a passkey on this device.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 space-y-4 border-t-2 border-foreground pt-6" aria-labelledby="passkeys-heading">
      <h2 id="passkeys-heading" className="font-heading text-2xl font-semibold">
        Passkeys
      </h2>
      <p className="text-muted-foreground">
        A passkey lets you sign in with your fingerprint, face or device PIN instead of a password. It stays on your device,
        cannot be phished, and counts as a strong sign-in on its own.
      </p>

      {passkeys.length > 0 ? (
        <ul className="grouped">
          {passkeys.map((passkey) => (
            <PasskeyRow key={passkey.id} passkey={passkey} />
          ))}
        </ul>
      ) : (
        <p className="border-y border-border py-4 text-muted-foreground">You have not added a passkey yet.</p>
      )}

      {supported ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="passkey-name">Name for this passkey (optional)</Label>
            <Input
              id="passkey-name"
              value={deviceName}
              maxLength={60}
              placeholder="For example: My phone"
              onChange={(e) => setDeviceName(e.target.value)}
              className="h-12 rounded-none text-base"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" className="h-12 text-base" onClick={add} disabled={busy}>
              <KeyRound aria-hidden="true" />
              {busy ? "Waiting for your device..." : "Add a passkey"}
            </Button>
            {added ? <SavedMark label="Passkey added" /> : null}
          </div>
          {error ? (
            <p className="border-2 border-destructive bg-destructive/5 p-3 text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground">This browser does not support passkeys.</p>
      )}
    </section>
  );
}
