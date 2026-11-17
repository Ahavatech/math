"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { auth, signIn } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser, defaultLandingPath } from "@/lib/rbac";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { verifyPassword } from "@/lib/password";
import { sendPasskeyChangedEmail } from "@/lib/email";
import { clientIpFromHeaders } from "@/lib/login-throttle";
import { changePasswordRateLimiter } from "@/lib/rate-limit";
import { checkPersistentLimit } from "@/server/services/rate-limits";
import { contextFromHeaders, logAction } from "@/server/services/audit";
import {
  finishRegistration,
  relyingPartyFor,
  removePasskey,
  startLogin,
  startRegistration,
} from "@/server/services/passkeys";
import { redirect } from "next/navigation";

const TOO_MANY = "Too many attempts. Please wait a minute and try again.";

export type PasskeyOptionsResult<T> = { options: T; challengeId: string } | { error: string };
export type PasskeyState = { error?: string; done?: boolean };

function rp() {
  return relyingPartyFor(env.AUTH_URL);
}

async function limitedByIp(name: string, limit: number): Promise<boolean> {
  const ip = clientIpFromHeaders(await headers());
  return (await checkPersistentLimit(db, { name, key: ip, limit, windowMs: 60_000 })).allowed;
}

async function notify(userId: string, what: "added" | "removed", deviceName: string) {
  const row = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!row) return;
  after(async () => {
    try {
      await sendPasskeyChangedEmail({ to: row.email, name: row.name, what, deviceName });
    } catch (error) {
      console.error(`Failed to send passkey notice for user ${userId}:`, error);
    }
  });
}

// ---------------------------------------------------------------- sign in

/** Step 1 of signing in with a passkey: a fresh challenge for the browser to sign. */
export async function passkeyLoginOptionsAction(): Promise<PasskeyOptionsResult<PublicKeyCredentialRequestOptionsJSON>> {
  if (!(await limitedByIp("passkey-options", 20))) return { error: TOO_MANY };
  return startLogin(db, rp());
}

/** Step 2: the signed answer. Signs the person in (or says it could not) and sends them where they were going. */
export async function passkeyLoginAction(input: {
  challengeId: string;
  response: AuthenticationResponseJSON;
  callbackUrl?: string;
}): Promise<{ error?: string }> {
  try {
    await signIn("passkey", {
      challengeId: input.challengeId,
      response: JSON.stringify(input.response),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as { code?: string }).code;
      return { error: code === "rate_limited" ? TOO_MANY : "That passkey was not accepted. Try again, or sign in with your password." };
    }
    throw error;
  }
  const session = await auth();
  const destination = safeCallbackPath(input.callbackUrl ?? null) ?? defaultLandingPath(session?.user?.roles ?? []);
  redirect(destination);
}

// ------------------------------------------------------- manage passkeys

export async function startPasskeyRegistrationAction(): Promise<PasskeyOptionsResult<PublicKeyCredentialCreationOptionsJSON>> {
  const user = await getCurrentUser({ pending: "allow" });
  if (!user || !user.isActive) return { error: "You must be signed in." };
  if (!(await changePasswordRateLimiter.check(`passkey:${user.id}`)).allowed) return { error: TOO_MANY };
  const row = await db.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } });
  if (!row) return { error: "You must be signed in." };
  try {
    return await startRegistration(db, { id: user.id, email: row.email, name: row.name }, rp());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start." };
  }
}

export async function finishPasskeyRegistrationAction(input: {
  challengeId: string;
  response: RegistrationResponseJSON;
  deviceName: string;
}): Promise<PasskeyState> {
  const user = await getCurrentUser({ pending: "allow" });
  if (!user || !user.isActive) return { error: "You must be signed in." };
  if (!(await changePasswordRateLimiter.check(`passkey:${user.id}`)).allowed) return { error: TOO_MANY };

  const result = await finishRegistration(
    db,
    { userId: user.id, challengeId: input.challengeId, response: input.response, deviceName: input.deviceName },
    rp(),
  );
  if (!result.ok) return { error: result.error };

  await logAction(
    db,
    {
      actorId: user.id,
      action: "user.passkey_added",
      entityType: "User",
      entityId: user.id,
      summary: "Added a passkey",
    },
    contextFromHeaders(await headers()),
  );
  await notify(user.id, "added", result.deviceName);
  revalidatePath("/two-factor");
  return { done: true };
}

export async function removePasskeyAction(_prev: PasskeyState | undefined, formData: FormData): Promise<PasskeyState> {
  const user = await getCurrentUser({ pending: "allow" });
  if (!user || !user.isActive) return { error: "You must be signed in." };
  if (!(await changePasswordRateLimiter.check(`passkey:${user.id}`)).allowed) return { error: TOO_MANY };

  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const password = String(formData.get("password") ?? "");
  if (!row?.passwordHash || !(await verifyPassword(row.passwordHash, password))) {
    return { error: "That password is not right." };
  }
  const id = String(formData.get("id") ?? "");
  const passkey = await db.passkey.findFirst({ where: { id, userId: user.id }, select: { deviceName: true } });
  if (!passkey || !(await removePasskey(db, user.id, id))) return { error: "That passkey was not found." };

  await logAction(
    db,
    {
      actorId: user.id,
      action: "user.passkey_removed",
      entityType: "User",
      entityId: user.id,
      summary: "Removed a passkey",
    },
    contextFromHeaders(await headers()),
  );
  await notify(user.id, "removed", passkey.deviceName);
  revalidatePath("/two-factor");
  return { done: true };
}
