import { db as defaultDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAction, type AuditRequestContext } from "@/server/services/audit";
import { consumeToken, peekToken } from "@/server/services/tokens";
import { passwordProblem, PASSWORD_PROBLEM_MESSAGE } from "@/lib/weak-password";
import { checkBreachedPassword } from "@/lib/breached-password";
import { env } from "@/lib/env";
import type { UserTokenType } from "@prisma/client";

type Db = typeof defaultDb;

export class WeakPasswordError extends Error {}

const BREACHED_MESSAGE =
  "That password has appeared in a public data breach, so it is not safe to use. Choose a different one, such as three or four unrelated words.";

/**
 * Why a new password should be refused, or null. First the quick local checks
 * (very common, patterns, built from the person's name or email), then, unless
 * switched off or running tests, the breached-password list. The list check
 * fails open: if that service cannot be reached the password is accepted.
 */
export async function newPasswordProblem(
  password: string,
  identity: { email?: string | null; name?: string | null },
): Promise<string | null> {
  const local = passwordProblem(password, identity);
  if (local) return PASSWORD_PROBLEM_MESSAGE[local];
  if (env.BREACHED_PASSWORD_CHECK !== "true" || env.NODE_ENV === "test") return null;
  const result = await checkBreachedPassword(password);
  return result?.breached ? BREACHED_MESSAGE : null;
}

export class WrongPasswordError extends Error {
  constructor() {
    super("The current password is incorrect.");
  }
}

/**
 * Changes a user's own password. Requires the current password to be
 * supplied and verified first. Stamps passwordChangedAt so other active
 * sessions are treated as signed out on their next roles recheck (see
 * refreshTokenRoles in src/auth.ts) - the best-effort invalidation that is
 * feasible for a JWT-strategy session with no server-side session store.
 */
export async function changeOwnPassword(
  db: Db,
  userId: string,
  input: { currentPassword: string; newPassword: string },
  context?: AuditRequestContext,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const problem = await newPasswordProblem(input.newPassword, { email: user.email, name: user.name });
  if (problem) throw new WeakPasswordError(problem);

  const currentOk = user.passwordHash
    ? await verifyPassword(user.passwordHash, input.currentPassword)
    : false;
  if (!currentOk) {
    throw new WrongPasswordError();
  }

  const passwordHash = await hashPassword(input.newPassword);
  const passwordChangedAt = new Date();
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt },
  });

  await logAction(
    db,
    {
      actorId: userId,
      action: "user.change_password",
      entityType: "User",
      entityId: userId,
      summary: "Changed own password",
    },
    context,
  );
}

export type SetPasswordResult =
  | { ok: true; user: { id: string; email: string; name: string } }
  | { ok: false; reason: "invalid-token" | "weak"; message: string };

/**
 * Sets a password from a one-time link (a reset or an invite). The password is
 * checked before the link is used up, so a refused password lets the person
 * try again with the same link. An inactive account cannot be reset into use,
 * and every other unused link of that kind is cancelled.
 */
export async function setPasswordFromToken(
  db: Db,
  input: { token: string; password: string; type: Extract<UserTokenType, "PASSWORD_RESET" | "INVITE"> },
  context?: AuditRequestContext,
): Promise<SetPasswordResult> {
  const invalid = {
    ok: false as const,
    reason: "invalid-token" as const,
    message:
      input.type === "INVITE"
        ? "This invite link is invalid or has expired."
        : "This reset link is invalid or has expired.",
  };

  const peeked = await peekToken(db, input.token, input.type);
  if (!peeked) return invalid;

  const user = await db.user.findUnique({
    where: { id: peeked.userId },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!user || !user.isActive) return invalid;

  const problem = await newPasswordProblem(input.password, { email: user.email, name: user.name });
  if (problem) return { ok: false, reason: "weak", message: problem };

  const consumed = await consumeToken(db, input.token, input.type);
  if (!consumed) return invalid;

  const passwordHash = await hashPassword(input.password);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  // Cancel any other link still waiting (an older reset email, say).
  await db.userToken.updateMany({
    where: { userId: user.id, type: input.type, usedAt: null },
    data: { usedAt: new Date() },
  });

  await logAction(
    db,
    {
      actorId: user.id,
      action: input.type === "INVITE" ? "user.accept_invite" : "user.reset_password",
      entityType: "User",
      entityId: user.id,
      summary: input.type === "INVITE" ? "Accepted invite and set password" : "Reset password via token",
    },
    context,
  );

  return { ok: true, user: { id: user.id, email: user.email, name: user.name } };
}
