import { db as defaultDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

type Db = typeof defaultDb;

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
