import type { PrismaClient, Role } from "@prisma/client";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normaliseRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "@/lib/totp";

type Db = Pick<PrismaClient, "user" | "recoveryCode" | "$transaction">;

/** Roles that can change the website or see private journal material. */
const TWO_FACTOR_REQUIRED_ROLES: Role[] = ["SUPER_ADMIN", "HOD", "ADMIN"];

export function twoFactorRequiredFor(roles: Role[]): boolean {
  return roles.some((role) => TWO_FACTOR_REQUIRED_ROLES.includes(role));
}

export type TwoFactorStatus = "off" | "pending" | "on";

export async function twoFactorStatus(db: Db, userId: string): Promise<TwoFactorStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!user?.totpSecretEnc) return "off";
  return user.totpEnabledAt ? "on" : "pending";
}

/**
 * Starts (or restarts) setup: makes a fresh secret and stores it encrypted but
 * not yet active. It only becomes active once the person proves their app
 * works by entering a code (confirmTwoFactor). Refuses if it is already on.
 */
export async function beginTwoFactorSetup(
  db: Db,
  userId: string,
  authSecret: string,
  issuer: string,
): Promise<{ secret: string; uri: string }> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true },
  });
  if (user.totpEnabledAt) throw new Error("Two-factor sign-in is already on.");

  const secret = generateTotpSecret();
  await db.user.update({
    where: { id: userId },
    data: { totpSecretEnc: encryptSecret(secret, authSecret), totpLastStep: null },
  });
  return { secret, uri: otpauthUri({ secret, account: user.email, issuer }) };
}

/** Returns the pending secret again, so the setup page survives a reload. */
export async function pendingTwoFactorSecret(
  db: Db,
  userId: string,
  authSecret: string,
  issuer: string,
): Promise<{ secret: string; uri: string } | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!user?.totpSecretEnc || user.totpEnabledAt) return null;
  const secret = decryptSecret(user.totpSecretEnc, authSecret);
  return { secret, uri: otpauthUri({ secret, account: user.email, issuer }) };
}

/**
 * Turns two-factor on if the code is right, and returns the recovery codes,
 * which are shown once and stored only as hashes.
 */
export async function confirmTwoFactor(
  db: Db,
  userId: string,
  code: string,
  authSecret: string,
  now: number = Date.now(),
): Promise<{ recoveryCodes: string[] } | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!user?.totpSecretEnc || user.totpEnabledAt) return null;

  const step = verifyTotp(decryptSecret(user.totpSecretEnc, authSecret), code, { now });
  if (step === null) return null;

  const recoveryCodes = generateRecoveryCodes();
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({
      data: recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })),
    }),
    db.user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date(now), totpLastStep: step },
    }),
  ]);
  return { recoveryCodes };
}

/**
 * Checks the second factor at sign-in: an authenticator code, or one of the
 * recovery codes (each works once). Returns true only on a match.
 */
export async function verifySecondFactor(
  db: Db,
  userId: string,
  input: string,
  authSecret: string,
  now: number = Date.now(),
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true },
  });
  if (!user?.totpSecretEnc || !user.totpEnabledAt) return false;

  const trimmed = input.trim();
  if (/^\d{3}\s?\d{3}$/.test(trimmed)) {
    const step = verifyTotp(decryptSecret(user.totpSecretEnc, authSecret), trimmed, {
      now,
      lastUsedStep: user.totpLastStep,
    });
    if (step === null) return false;
    // The condition makes the step single-use even if two requests race.
    const claimed = await db.user.updateMany({
      where: {
        id: userId,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
      },
      data: { totpLastStep: step },
    });
    return claimed.count === 1;
  }

  if (normaliseRecoveryCode(trimmed).length !== 12) return false;
  const used = await db.recoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(trimmed), usedAt: null },
    data: { usedAt: new Date(now) },
  });
  return used.count === 1;
}

export async function remainingRecoveryCodes(db: Db, userId: string): Promise<number> {
  return db.recoveryCode.count({ where: { userId, usedAt: null } });
}

/** Makes a new set of recovery codes; the old ones stop working. */
export async function regenerateRecoveryCodes(db: Db, userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })),
    }),
  ]);
  return codes;
}

/** Turns two-factor off and forgets the secret and recovery codes. */
export async function disableTwoFactor(db: Db, userId: string): Promise<void> {
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.user.update({
      where: { id: userId },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null },
    }),
  ]);
}
