"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut, auth } from "@/auth";
import { db } from "@/lib/db";
import { safeCallbackPath } from "@/lib/safe-redirect";
import { defaultLandingPath } from "@/lib/rbac";
import { issueToken } from "@/server/services/tokens";
import { revokeSession, purgeExpiredRevocations } from "@/server/services/sessions";
import { after } from "next/server";
import { contextFromHeaders } from "@/server/services/audit";
import {
  changeOwnPassword,
  setPasswordFromToken,
  WeakPasswordError,
  WrongPasswordError,
} from "@/server/services/account";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema,
  changePasswordSchema,
} from "@/lib/validators/auth";
import {
  forgotPasswordRateLimiter,
  tokenConsumeRateLimiter,
  changePasswordRateLimiter,
} from "@/lib/rate-limit";
import { sendPasswordResetEmail, sendPasswordChangedEmail } from "@/lib/email";

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
}

const GENERIC_LOGIN_ERROR = "Incorrect email or password.";
const RATE_LIMITED_ERROR = "Too many attempts. Please try again later.";

export type LoginState = { error?: string; needsCode?: boolean };

export async function loginAction(
  _prevState: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  // Where to go afterwards: a safe return address if one was given,
  // otherwise the right place for this person's roles. Working this out
  // before signing in reveals nothing to the visitor: it only takes effect
  // if the password turns out to be right.
  const requested = safeCallbackPath(formData.get("callbackUrl"));
  const account = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { roles: { select: { role: true } } },
  });
  const destination = requested ?? defaultLandingPath(account?.roles.map((r) => r.role) ?? []);

  try {
    // Rate limiting happens inside the Auth.js credentials check (src/auth.ts)
    // so it also covers the /api/auth/callback/credentials endpoint.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      totp: typeof formData.get("totp") === "string" ? (formData.get("totp") as string) : "",
      redirectTo: destination,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as { code?: string }).code;
      if (code === "totp_required") return { needsCode: true };
      if (code === "totp_invalid") {
        return {
          needsCode: true,
          error: "That code is not right. Try the current code from your app, or a recovery code.",
        };
      }
      return { error: code === "rate_limited" ? RATE_LIMITED_ERROR : GENERIC_LOGIN_ERROR };
    }
    // next-auth throws a redirect "error" on success; let it propagate.
    throw error;
  }
}

export async function logoutAction() {
  // End this session on the server first, so a copy of the cookie stops
  // working too, then clear the cookie in this browser.
  const session = await auth();
  if (session?.sessionId && session.user?.id) {
    try {
      await revokeSession(db, {
        jti: session.sessionId,
        userId: session.user.id,
        expiresAt: new Date(session.sessionExpiresAt ?? Date.now() + 12 * 60 * 60 * 1000),
      });
      await purgeExpiredRevocations(db);
    } catch (error) {
      console.error("Could not record the sign-out on the server:", error);
    }
  }
  await signOut({ redirectTo: "/login" });
}

/** Signs this account out on every device, including this one. */
export async function signOutEverywhereAction() {
  const session = await auth();
  if (session?.user?.id) {
    // Every token stamped with an older passwordChangedAt stops working.
    await db.user.update({ where: { id: session.user.id }, data: { passwordChangedAt: new Date() } });
  }
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
    // Send after the response has gone: waiting for the mail provider would
    // make this path visibly slower for real accounts than for unknown
    // addresses, which would leak exactly what the generic message hides. A
    // failure is logged and never changes what the visitor sees.
    after(async () => {
      try {
        await sendPasswordResetEmail({ to: user.email, token });
      } catch (error) {
        console.error(`Failed to send password reset email for user ${user.id}:`, error);
      }
    });
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

  const result = await setPasswordFromToken(
    db,
    { token: parsed.data.token, password: parsed.data.password, type: "PASSWORD_RESET" },
    contextFromHeaders(await headers()),
  );
  if (!result.ok) return { error: result.message };

  // Tell the owner, so a reset they did not ask for does not go unnoticed.
  after(async () => {
    try {
      await sendPasswordChangedEmail({ to: result.user.email, name: result.user.name, how: "reset" });
    } catch (error) {
      console.error(`Failed to send password-changed notice for user ${result.user.id}:`, error);
    }
  });

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

  const result = await setPasswordFromToken(
    db,
    { token: parsed.data.token, password: parsed.data.password, type: "INVITE" },
    contextFromHeaders(await headers()),
  );
  if (!result.ok) return { error: result.message };

  return { success: true };
}

export async function changePasswordAction(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const ip = await clientIp();
  if (!changePasswordRateLimiter.check(`user:${session.user.id}`).allowed) {
    return { error: RATE_LIMITED_ERROR };
  }
  if (!changePasswordRateLimiter.check(`ip:${ip}`).allowed) {
    return { error: RATE_LIMITED_ERROR };
  }

  try {
    await changeOwnPassword(
      db,
      session.user.id,
      { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword },
      contextFromHeaders(await headers()),
    );
  } catch (error) {
    if (error instanceof WrongPasswordError || error instanceof WeakPasswordError) {
      return { error: error.message };
    }
    throw error;
  }

  if (session.user.email) {
    const to = session.user.email;
    const name = session.user.name ?? "";
    after(async () => {
      try {
        await sendPasswordChangedEmail({ to, name, how: "change" });
      } catch (error) {
        console.error("Failed to send password-changed notice:", error);
      }
    });
  }

  return { success: true };
}
