import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "users.manage",
  "site.edit",
  "academics.manage",
  "lecturers.manage",
  "news.manage",
  "events.manage",
  "alumni.review",
  "journal.edit",
  "journal.review",
  "journal.submit",
  "own_profile.edit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role -> permission mapping, derived from docs/SCOPE.md's "Roles and
 * admin control" table. users.manage belongs to SUPER_ADMIN only
 * (Stage 03's /admin/users is restricted to that role, per the prompt).
 *
 * See docs/DECISIONS.md's entry amending #23/#24: site.edit (site
 * settings, navigation, pages, hero, HOD address) is HOD/SUPER_ADMIN
 * only. academics.manage (programmes, research areas) is held by
 * SUPER_ADMIN, HOD and ADMIN - ADMIN no longer holds site.edit.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  HOD: [
    "site.edit",
    "academics.manage",
    "lecturers.manage",
    "news.manage",
    "events.manage",
    "alumni.review",
    "own_profile.edit",
  ],
  ADMIN: [
    "academics.manage",
    "lecturers.manage",
    "news.manage",
    "events.manage",
    "alumni.review",
    "own_profile.edit",
  ],
  LECTURER: ["own_profile.edit"],
  JOURNAL_EDITOR_IN_CHIEF: ["journal.edit", "own_profile.edit"],
  JOURNAL_EDITOR: ["journal.edit", "own_profile.edit"],
  REVIEWER: ["journal.review", "own_profile.edit"],
  AUTHOR: ["journal.submit", "own_profile.edit"],
};

export type SessionUser = {
  id: string;
  roles: Role[];
  isActive: boolean;
};

/**
 * Reads the current session's user, or null when signed out. This is
 * the only place in the app that should read `auth()` directly for
 * authorization purposes; everything else should go through this or
 * the require* helpers below.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // Dynamically imported so a test exercising only this file's pure
  // functions (hasRole, hasPermission, canEditLecturerProfile, ...)
  // never has to resolve next-auth's module graph.
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    roles: session.user.roles,
    isActive: session.user.isActive,
  };
}

/** Throws UnauthorizedError when signed out or inactive. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    throw new UnauthorizedError();
  }
  return user;
}

export function hasRole(user: SessionUser, role: Role | Role[]): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return user.roles.some((r) => roles.includes(r));
}

export function hasPermission(user: SessionUser, permission: Permission): boolean {
  return user.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Throws UnauthorizedError unless user is non-null, active, and holds at
 * least one of the given roles. Returns the user (narrowed non-null) so
 * callers can chain: `const user = requireRole(await getCurrentUser(), "ADMIN")`.
 */
export function requireRole(user: SessionUser | null, role: Role | Role[]): SessionUser {
  if (!user || !user.isActive || !hasRole(user, role)) {
    throw new UnauthorizedError();
  }
  return user;
}

export function requirePermission(
  user: SessionUser | null,
  permission: Permission,
): SessionUser {
  if (!user || !user.isActive || !hasPermission(user, permission)) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * A lecturer may edit only their own portfolio; an admin with
 * lecturers.manage may edit any of them.
 */
export function canEditLecturerProfile(
  user: SessionUser,
  profile: { userId: string },
): boolean {
  return user.id === profile.userId || hasPermission(user, "lecturers.manage");
}
