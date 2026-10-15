import "server-only";
import type { PrismaClient, Role } from "@prisma/client";
import { issueToken } from "@/server/services/tokens";
import { logAction, type AuditRequestContext } from "@/server/services/audit";
import { sendInviteEmail } from "@/lib/email";
import { UnauthorizedError } from "@/lib/rbac";

export class SelfActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelfActionError";
  }
}

/**
 * Explicit select, not include: never return passwordHash or any other
 * sensitive column. This result is passed straight to a client
 * component on /admin/users, and a Server->Client Component prop is
 * serialized into the page's RSC payload — an `include` here would ship
 * every user's password hash to the browser.
 */
export async function listUsers(db: PrismaClient) {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      passwordHash: true,
      roles: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // passwordHash is selected only to derive this boolean ("invite still
  // pending" vs "password set") and is stripped before returning, since
  // this result is passed to a client component and a Server->Client
  // Component prop is serialized into the page's RSC payload.
  return users.map(({ passwordHash, ...user }) => ({
    ...user,
    hasPassword: passwordHash !== null,
  }));
}

export type SafeUser = Awaited<ReturnType<typeof listUsers>>[number];

export async function inviteUser(
  db: PrismaClient,
  actorId: string,
  params: { email: string; name: string; roles: Role[] },
  context?: AuditRequestContext,
) {
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: params.email,
        name: params.name,
        isActive: true,
        roles: { create: params.roles.map((role) => ({ role })) },
      },
    });

    await logAction(
      tx,
      {
        actorId,
        action: "user.invite",
        entityType: "User",
        entityId: created.id,
        summary: `Invited user with roles ${params.roles.join(", ")}`,
      },
      context,
    );

    return created;
  });

  const { token } = await issueToken(db, user.id, "INVITE");
  // The user row and its token are already durably created at this
  // point; a failed send (bad Resend config, provider outage) should
  // not surface as if the whole invite failed, since the admin can
  // already recover with "Resend invite". Log it loudly instead of
  // throwing, so it is not silently lost either.
  try {
    await sendInviteEmail({ to: user.email, name: user.name, token });
  } catch (error) {
    console.error(`Failed to send invite email for user ${user.id}:`, error);
  }

  return user;
}

export async function resendInvite(
  db: PrismaClient,
  actorId: string,
  userId: string,
  context?: AuditRequestContext,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const { token } = await issueToken(db, user.id, "INVITE");
  try {
    await sendInviteEmail({ to: user.email, name: user.name, token });
  } catch (error) {
    console.error(`Failed to resend invite email for user ${user.id}:`, error);
  }

  await logAction(
    db,
    {
      actorId,
      action: "user.resend_invite",
      entityType: "User",
      entityId: user.id,
      summary: "Resent invite",
    },
    context,
  );
}

export async function editUserRoles(
  db: PrismaClient,
  actorId: string,
  userId: string,
  roles: Role[],
  context?: AuditRequestContext,
) {
  if (userId === actorId && !roles.includes("SUPER_ADMIN")) {
    throw new SelfActionError("You cannot remove your own SUPER_ADMIN role");
  }

  await db.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({ data: roles.map((role) => ({ userId, role })) });

    await logAction(
      tx,
      {
        actorId,
        action: "user.edit_roles",
        entityType: "User",
        entityId: userId,
        summary: `Set roles to ${roles.join(", ")}`,
      },
      context,
    );
  });
}

export async function setUserActive(
  db: PrismaClient,
  actorId: string,
  userId: string,
  isActive: boolean,
  context?: AuditRequestContext,
) {
  if (userId === actorId && !isActive) {
    throw new SelfActionError("You cannot deactivate yourself");
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive } });

    await logAction(
      tx,
      {
        actorId,
        action: isActive ? "user.reactivate" : "user.deactivate",
        entityType: "User",
        entityId: userId,
        summary: isActive ? "Reactivated user" : "Deactivated user",
      },
      context,
    );
  });
}

/** Re-exported for convenience at call sites that only need the error types. */
export { UnauthorizedError };
