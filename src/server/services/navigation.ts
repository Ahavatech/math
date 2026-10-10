import "server-only";
import type { NavLocation, PrismaClient } from "@prisma/client";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

/** Every top-level public route an internal nav link may point into. */
const KNOWN_ROUTE_PREFIXES = [
  "/",
  "/about",
  "/programmes",
  "/research",
  "/staff",
  "/lecturer",
  "/news",
  "/events",
  "/alumni",
  "/students",
  "/journal",
  "/contact",
];

export function validateNavHref(href: string): { valid: boolean; reason?: string } {
  if (!href) return { valid: false, reason: "A link is required" };

  if (href.startsWith("mailto:")) {
    return href.length > "mailto:".length
      ? { valid: true }
      : { valid: false, reason: "Invalid mailto link" };
  }

  if (href.startsWith("http://") || href.startsWith("https://")) {
    try {
      new URL(href);
      return { valid: true };
    } catch {
      return { valid: false, reason: "Invalid external URL" };
    }
  }

  if (href.startsWith("/")) {
    const matchesKnownRoute = KNOWN_ROUTE_PREFIXES.some(
      (prefix) => href === prefix || href.startsWith(`${prefix}/`),
    );
    return matchesKnownRoute
      ? { valid: true }
      : { valid: false, reason: "Not a known internal route" };
  }

  return { valid: false, reason: "A link must start with /, https:// or mailto:" };
}

export async function reorderNavItem(
  db: PrismaClient,
  itemId: string,
  direction: "up" | "down",
): Promise<void> {
  const item = await db.navItem.findUniqueOrThrow({ where: { id: itemId } });

  const siblings = await db.navItem.findMany({
    where: { location: item.location, parentId: item.parentId },
    orderBy: { order: "asc" },
  });

  const index = siblings.findIndex((s) => s.id === item.id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return;

  const other = siblings[swapIndex];

  await db.$transaction([
    db.navItem.update({ where: { id: item.id }, data: { order: other.order } }),
    db.navItem.update({ where: { id: other.id }, data: { order: item.order } }),
  ]);
}

export async function listNavItems(db: PrismaClient, location: NavLocation) {
  return db.navItem.findMany({ where: { location }, orderBy: { order: "asc" } });
}

export async function createNavItem(
  db: PrismaClient,
  actorId: string,
  params: {
    label: string;
    href: string;
    location: NavLocation;
    parentId: string | null;
  },
  context?: AuditRequestContext,
) {
  const validation = validateNavHref(params.href);
  if (!validation.valid) {
    throw new Error(validation.reason ?? "Invalid link");
  }

  const siblingCount = await db.navItem.count({
    where: { location: params.location, parentId: params.parentId },
  });

  const item = await db.navItem.create({
    data: {
      label: params.label,
      href: params.href,
      location: params.location,
      parentId: params.parentId,
      order: siblingCount,
    },
  });

  await logAction(
    db,
    {
      actorId,
      action: "nav.create",
      entityType: "NavItem",
      entityId: item.id,
      summary: `Added "${params.label}" to ${params.location.toLowerCase()} navigation`,
    },
    context,
  );

  return item;
}

export async function updateNavItem(
  db: PrismaClient,
  actorId: string,
  itemId: string,
  params: { label: string; href: string },
  context?: AuditRequestContext,
) {
  const validation = validateNavHref(params.href);
  if (!validation.valid) {
    throw new Error(validation.reason ?? "Invalid link");
  }

  await db.navItem.update({ where: { id: itemId }, data: params });

  await logAction(
    db,
    {
      actorId,
      action: "nav.update",
      entityType: "NavItem",
      entityId: itemId,
      summary: `Updated "${params.label}"`,
    },
    context,
  );
}

export async function setNavItemVisibility(
  db: PrismaClient,
  actorId: string,
  itemId: string,
  isVisible: boolean,
  context?: AuditRequestContext,
) {
  await db.navItem.update({ where: { id: itemId }, data: { isVisible } });

  await logAction(
    db,
    {
      actorId,
      action: isVisible ? "nav.show" : "nav.hide",
      entityType: "NavItem",
      entityId: itemId,
      summary: isVisible ? "Made navigation item visible" : "Hid navigation item",
    },
    context,
  );
}

export async function deleteNavItem(
  db: PrismaClient,
  actorId: string,
  itemId: string,
  context?: AuditRequestContext,
) {
  await db.navItem.delete({ where: { id: itemId } });

  await logAction(
    db,
    {
      actorId,
      action: "nav.delete",
      entityType: "NavItem",
      entityId: itemId,
      summary: "Deleted navigation item",
    },
    context,
  );
}
