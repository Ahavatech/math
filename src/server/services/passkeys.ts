import type { PrismaClient } from "@prisma/client";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport as AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

type Db = Pick<PrismaClient, "passkey" | "webAuthnChallenge" | "user">;

/** Where the site lives, as the browser sees it. A passkey only works on the site that made it. */
export type RelyingParty = { name: string; id: string; origin: string };

export function relyingPartyFor(authUrl: string): RelyingParty {
  const url = new URL(authUrl);
  return { name: "OAU Mathematics", id: url.hostname, origin: url.origin };
}

const CHALLENGE_TTL_MS = 5 * 60_000;
export const MAX_PASSKEYS_PER_USER = 10;
// Postgres INTEGER; some authenticators count up to 2^32.
const MAX_COUNTER = 2_147_483_647;

async function storeChallenge(db: Db, purpose: "register" | "login", challenge: string, userId?: string) {
  const row = await db.webAuthnChallenge.create({
    data: { challenge, purpose, userId: userId ?? null, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  if (Math.random() < 0.05) {
    await db.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
  return row.id;
}

/** A challenge can be used once. Returns it only if it is fresh and for this purpose. */
async function takeChallenge(db: Db, id: string, purpose: "register" | "login") {
  const row = await db.webAuthnChallenge.findUnique({ where: { id } });
  if (!row) return null;
  // Deleting first makes it single-use even if two requests race.
  const { count } = await db.webAuthnChallenge.deleteMany({ where: { id } });
  if (count !== 1) return null;
  if (row.purpose !== purpose || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function listPasskeys(db: Db, userId: string) {
  return db.passkey.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
  });
}

export async function countPasskeys(db: Db, userId: string): Promise<number> {
  return db.passkey.count({ where: { userId } });
}

export async function startRegistration(
  db: Db,
  user: { id: string; email: string; name: string },
  rp: RelyingParty,
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }> {
  const existing = await db.passkey.findMany({ where: { userId: user.id }, select: { credentialId: true, transports: true } });
  if (existing.length >= MAX_PASSKEYS_PER_USER) throw new Error("You have reached the limit of passkeys. Remove one first.");

  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    // A passkey that lives on the device and proves the person is there
    // (fingerprint, face or PIN), so it counts as a strong sign-in on its own.
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const challengeId = await storeChallenge(db, "register", options.challenge, user.id);
  return { options, challengeId };
}

export type RegistrationResult = { ok: true; deviceName: string } | { ok: false; error: string };

export async function finishRegistration(
  db: Db,
  input: { userId: string; challengeId: string; response: RegistrationResponseJSON; deviceName: string },
  rp: RelyingParty,
): Promise<RegistrationResult> {
  const challenge = await takeChallenge(db, input.challengeId, "register");
  if (!challenge || challenge.userId !== input.userId) {
    return { ok: false, error: "That request has expired. Please try adding the passkey again." };
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: true,
    });
  } catch {
    return { ok: false, error: "The passkey could not be verified. Please try again." };
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: "The passkey could not be verified. Please try again." };
  }

  const { credential } = verification.registrationInfo;
  const deviceName = input.deviceName.trim().slice(0, 60) || "Passkey";
  try {
    await db.passkey.create({
      data: {
        userId: input.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: Math.min(credential.counter, MAX_COUNTER),
        transports: (credential.transports ?? []) as string[],
        deviceName,
      },
    });
  } catch {
    // The credential id is unique: the same authenticator cannot be added twice.
    return { ok: false, error: "This passkey is already registered." };
  }
  return { ok: true, deviceName };
}

export async function startLogin(
  db: Db,
  rp: RelyingParty,
): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }> {
  // No email asked for first: the passkey itself says who is signing in.
  const options = await generateAuthenticationOptions({ rpID: rp.id, userVerification: "required" });
  const challengeId = await storeChallenge(db, "login", options.challenge);
  return { options, challengeId };
}

/** Checks a sign-in with a passkey. Returns the user's id, or null for any failure (no detail given). */
export async function verifyLogin(
  db: Db,
  input: { challengeId: string; response: AuthenticationResponseJSON },
  rp: RelyingParty,
): Promise<{ userId: string } | null> {
  const challenge = await takeChallenge(db, input.challengeId, "login");
  if (!challenge) return null;

  const passkey = await db.passkey.findUnique({ where: { credentialId: input.response.id } });
  if (!passkey) return null;

  try {
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: true,
    });
    if (!verification.verified) return null;
    await db.passkey.update({
      where: { id: passkey.id },
      data: { counter: Math.min(verification.authenticationInfo.newCounter, MAX_COUNTER), lastUsedAt: new Date() },
    });
    return { userId: passkey.userId };
  } catch {
    return null;
  }
}

export async function removePasskey(db: Db, userId: string, passkeyId: string): Promise<boolean> {
  const { count } = await db.passkey.deleteMany({ where: { id: passkeyId, userId } });
  return count === 1;
}
