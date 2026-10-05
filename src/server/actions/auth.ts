"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { consumeToken, issueToken } from "@/server/services/tokens";
import { logAction, contextFromHeaders } from "@/server/services/audit";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema,
} from "@/lib/validators/auth";
import {
  loginRateLimiter,
  forgotPasswordRateLimiter,
  tokenConsumeRateLimiter,
} from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
}

const GENERIC_LOGIN_ERROR = "Incorrect email or password.";
const RATE_LIMITED_ERROR = "Too many attempts. Please try again later.";

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const ip = await clientIp();
  const ipCheck = loginRateLimiter.check(`ip:${ip}`);
  const emailCheck = loginRateLimiter.check(`email:${parsed.data.email}`);
  if (!ipCheck.allowed || !emailCheck.allowed) {
    return { error: RATE_LIMITED_ERROR };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/admin",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: GENERIC_LOGIN_ERROR };
    }
    // next-auth throws a redirect "error" on success; let it propagate.
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, a reset link has been sent.";

export async function forgotPasswordAction(
  _prevState: { message?: string; error?: string } | undefined,
  formData: FormData,
): Promise<{ message?: string; error?: string }> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  const ip = await clientIp();
  const ipCheck = forgotPasswordRateLimiter.check(`ip:${ip}`);
  const emailCheck = forgotPasswordRateLimiter.check(`email:${parsed.data.email}`);
  if (!ipCheck.allowed || !emailCheck.allowed) {
    return { error: RATE_LIMITED_ERROR };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user && user.isActive) {
    const { token } = await issueToken(db, user.id, "PASSWORD_RESET");
    try {
      await sendPasswordResetEmail({ to: user.email, token });
    } catch (error) {
      // Must not throw past this point: a thrown error here would
      // produce a different response than the generic message below,
      // which would leak exactly the "does this email exist" signal
      // this flow exists to hide.
      console.error(`Failed to send password reset email for user ${user.id}:`, error);
    }
  }

  return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
}

export async function resetPasswordAction(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = await clientIp();
  if (!tokenConsumeRateLimiter.check(`ip:${ip}`).allowed) {
    return { error: RATE_LIMITED_ERROR };
  }

  const consumed = await consumeToken(db, parsed.data.token, "PASSWORD_RESET");
  if (!consumed) {
    return { error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.update({
    where: { id: consumed.userId },
    data: { passwordHash },
  });

  await logAction(
    db,
    {
      actorId: consumed.userId,
      action: "user.reset_password",
      entityType: "User",
      entityId: consumed.userId,
      summary: "Reset password via token",
    },
    contextFromHeaders(await headers()),
  );

  return { success: true };
}

export async function acceptInviteAction(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = await clientIp();
  if (!tokenConsumeRateLimiter.check(`ip:${ip}`).allowed) {
    return { error: RATE_LIMITED_ERROR };
  }

  const consumed = await consumeToken(db, parsed.data.token, "INVITE");
  if (!consumed) {
    return { error: "This invite link is invalid or has expired." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.update({
    where: { id: consumed.userId },
    data: { passwordHash },
  });

  await logAction(
    db,
    {
      actorId: consumed.userId,
      action: "user.accept_invite",
      entityType: "User",
      entityId: consumed.userId,
      summary: "Accepted invite and set password",
    },
    contextFromHeaders(await headers()),
  );

  return { success: true };
}
