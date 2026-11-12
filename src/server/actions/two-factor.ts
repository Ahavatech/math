"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/rbac";
import { verifyPassword } from "@/lib/password";
import { changePasswordRateLimiter } from "@/lib/rate-limit";
import { contextFromHeaders, logAction } from "@/server/services/audit";
import {
  beginTwoFactorSetup,
  confirmTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  twoFactorRequiredFor,
} from "@/server/services/two-factor";

const ISSUER = "OAU Mathematics";
const TOO_MANY = "Too many attempts. Please wait a minute and try again.";

export type TwoFactorState = { error?: string; recoveryCodes?: string[]; done?: boolean };

async function signedInUser() {
  const user = await getCurrentUser();
  return user && user.isActive ? user : null;
}

export async function startTwoFactorSetupAction(): Promise<void> {
  const user = await signedInUser();
  if (!user) return;
  try {
    await beginTwoFactorSetup(db, user.id, env.AUTH_SECRET, ISSUER);
  } catch {
    // Already on: nothing to start.
  }
  revalidatePath("/two-factor");
}

export async function confirmTwoFactorAction(
  _prev: TwoFactorState | undefined,
  formData: FormData,
): Promise<TwoFactorState> {
  const user = await signedInUser();
  if (!user) return { error: "You must be signed in." };
  if (!changePasswordRateLimiter.check(`2fa:${user.id}`).allowed) return { error: TOO_MANY };

  const code = String(formData.get("code") ?? "");
  const result = await confirmTwoFactor(db, user.id, code, env.AUTH_SECRET);
  if (!result) return { error: "That code is not right. Check the current code in your app and try again." };

  await logAction(
    db,
    {
      actorId: user.id,
      action: "user.two_factor_on",
      entityType: "User",
      entityId: user.id,
      summary: "Turned on two-factor sign-in",
    },
    contextFromHeaders(await headers()),
  );
  revalidatePath("/two-factor");
  return { recoveryCodes: result.recoveryCodes };
}

async function passwordIsRight(userId: string, password: string): Promise<boolean> {
  const row = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return row?.passwordHash ? verifyPassword(row.passwordHash, password) : false;
}

export async function regenerateRecoveryCodesAction(
  _prev: TwoFactorState | undefined,
  formData: FormData,
): Promise<TwoFactorState> {
  const user = await signedInUser();
  if (!user) return { error: "You must be signed in." };
  if (!changePasswordRateLimiter.check(`2fa:${user.id}`).allowed) return { error: TOO_MANY };
  if (!(await passwordIsRight(user.id, String(formData.get("password") ?? "")))) {
    return { error: "That password is not right." };
  }
  const recoveryCodes = await regenerateRecoveryCodes(db, user.id);
  await logAction(
    db,
    {
      actorId: user.id,
      action: "user.recovery_codes_regenerated",
      entityType: "User",
      entityId: user.id,
      summary: "Made new recovery codes",
    },
    contextFromHeaders(await headers()),
  );
  revalidatePath("/two-factor");
  return { recoveryCodes };
}

export async function disableTwoFactorAction(
  _prev: TwoFactorState | undefined,
  formData: FormData,
): Promise<TwoFactorState> {
  const user = await signedInUser();
  if (!user) return { error: "You must be signed in." };
  if (env.ADMIN_2FA_REQUIRED === "true" && twoFactorRequiredFor(user.roles)) {
    return { error: "Two-factor sign-in is required for your role and cannot be turned off." };
  }
  if (!changePasswordRateLimiter.check(`2fa:${user.id}`).allowed) return { error: TOO_MANY };
  if (!(await passwordIsRight(user.id, String(formData.get("password") ?? "")))) {
    return { error: "That password is not right." };
  }
  await disableTwoFactor(db, user.id);
  await logAction(
    db,
    {
      actorId: user.id,
      action: "user.two_factor_off",
      entityType: "User",
      entityId: user.id,
      summary: "Turned off two-factor sign-in",
    },
    contextFromHeaders(await headers()),
  );
  revalidatePath("/two-factor");
  return { done: true };
}
