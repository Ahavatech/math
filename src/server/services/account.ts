import { db as defaultDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAction, type AuditRequestContext } from "@/server/services/audit";
import { consumeToken, peekToken } from "@/server/services/tokens";
import { passwordProblem, PASSWORD_PROBLEM_MESSAGE } from "@/lib/weak-password";
import type { UserTokenType } from "@prisma/client";

type Db = typeof defaultDb;

export class WeakPasswordError extends Error {}

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

  const problem = passwordProblem(input.newPassword, { email: user.email, name: user.name });
  if (problem) throw new WeakPasswordError(PASSWORD_PROBLEM_MESSAGE[problem]);

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

  const problem = passwordProblem(input.password, { email: user.email, name: user.name });
  if (problem) return { ok: false, reason: "weak", message: PASSWORD_PROBLEM_MESSAGE[problem] };

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
