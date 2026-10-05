import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { Prisma, PrismaClient, UserTokenType } from "@prisma/client";

const TOKEN_TTL: Record<UserTokenType, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

type Db = PrismaClient | Prisma.TransactionClient;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a new token of the given type for a user. Any earlier unused
 * token of the same type for the same user is invalidated (marked used)
 * so only the newest token can ever be consumed. The plaintext token is
 * returned once and never stored; only its sha256 hash is persisted.
 */
export async function issueToken(db: Db, userId: string, type: UserTokenType) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL[type]);

  const row = await db.$transaction(async (tx) => {
    await tx.userToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });

    return tx.userToken.create({
      data: { userId, type, tokenHash, expiresAt },
    });
  });

  return { id: row.id, token, expiresAt };
}

/**
 * Consumes a token: valid, unused, unexpired, and of the expected type.
 * Marks it used atomically and returns the owning userId, or null if the
 * token is invalid for any reason. Never throws on an invalid token.
 */
export async function consumeToken(
  db: Db,
  token: string,
  type: UserTokenType,
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const row = await tx.userToken.findUnique({ where: { tokenHash } });

    if (
      !row ||
      row.type !== type ||
      row.usedAt !== null ||
      row.expiresAt.getTime() < Date.now()
    ) {
      return null;
    }

    await tx.userToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    return { userId: row.userId };
  });
}
