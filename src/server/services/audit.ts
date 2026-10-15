import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Writes one AuditLog row. `summary` must never contain a password,
 * token, or full email address — callers pass a human-readable
 * description (e.g. "invited user", "deactivated user a***@example.com"
 * is still too much; prefer an opaque reference like a user id or name).
 */
export async function logAction(
  db: Db,
  params: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    diff?: Prisma.InputJsonValue;
  },
  context?: AuditRequestContext,
) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
      diff: params.diff,
      ip: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
    },
  });
}

/** Extracts a best-effort client IP and user agent from request headers. */
export function contextFromHeaders(headers: Headers): AuditRequestContext {
  const forwardedFor = headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  return {
    ip,
    userAgent: headers.get("user-agent"),
  };
}
