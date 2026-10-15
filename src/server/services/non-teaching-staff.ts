import "server-only";
import type { PrismaClient } from "@prisma/client";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";
import { getSetting, setSetting } from "./site-settings";
import { nonTeachingStaffInputSchema } from "@/lib/validators/non-teaching-staff";

export async function listNonTeachingStaffAdmin(db: PrismaClient) {
  return db.nonTeachingStaff.findMany({ orderBy: { order: "asc" }, include: { photo: true } });
}

export async function getNonTeachingStaffById(db: PrismaClient, id: string) {
  return db.nonTeachingStaff.findUniqueOrThrow({ where: { id }, include: { photo: true } });
}

/** Public-safe: active records only; email/phone only when showContact is true. */
export async function listNonTeachingStaffPublic(db: PrismaClient) {
  try {
    const rows = await db.nonTeachingStaff.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        position: true,
        email: true,
        phone: true,
        showContact: true,
        photo: { select: { id: true, url: true, alt: true } },
      },
    });
    return rows.map((row) => ({
      ...row,
      email: row.showContact ? row.email : null,
      phone: row.showContact ? row.phone : null,
    }));
  } catch {
    return [];
  }
}

export async function createNonTeachingStaff(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = nonTeachingStaffInputSchema.parse(input);
  const max = await db.nonTeachingStaff.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;

  return db.$transaction(async (tx) => {
    const created = await tx.nonTeachingStaff.create({ data: { ...parsed, order } });
    await createRevision(tx, { entityType: "NonTeachingStaff", entityId: created.id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "non_teaching_staff.create", entityType: "NonTeachingStaff", entityId: created.id, summary: `Created ${created.name}` },
      context,
    );
    return created;
  });
}

export async function updateNonTeachingStaff(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = nonTeachingStaffInputSchema.parse(input);
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.nonTeachingStaff.update({ where: { id }, data: parsed });
    await createRevision(tx, { entityType: "NonTeachingStaff", entityId: id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "non_teaching_staff.update", entityType: "NonTeachingStaff", entityId: id, summary: `Updated ${result.name}` },
      context,
    );
    return result;
  });

  // Saving a seeded record IS the HOD review it was flagged for.
  const flags = await getSetting(db, "staff.importFlags");
  if (flags[id]) {
    const { [id]: _removed, ...rest } = flags;
    await setSetting(db, "staff.importFlags", rest, actorId, context);
  }

  return updated;
}

export async function setNonTeachingStaffActive(
  db: PrismaClient,
  id: string,
  isActive: boolean,
  actorId: string,
  context?: AuditRequestContext,
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.nonTeachingStaff.update({ where: { id }, data: { isActive } });
    await logAction(
      tx,
      {
        actorId,
        action: "non_teaching_staff.set_active",
        entityType: "NonTeachingStaff",
        entityId: id,
        summary: `Set ${updated.name} ${isActive ? "active" : "archived"}`,
      },
      context,
    );
    return updated;
  });
}

/** Swaps `order` with the adjacent sibling; a no-op at either boundary or with one item. */
export async function reorderNonTeachingStaff(db: PrismaClient, id: string, direction: "up" | "down"): Promise<void> {
  const target = await db.nonTeachingStaff.findUniqueOrThrow({ where: { id } });
  const siblings = await db.nonTeachingStaff.findMany({ orderBy: { order: "asc" } });

  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.nonTeachingStaff.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.nonTeachingStaff.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}

export type SeedNonTeachingStaffEntry = { name: string; position: string };

/**
 * Idempotent: creates a record only when no existing row has that exact
 * name, and never touches a row that already exists - an admin's edit to
 * a seeded record (or a re-run with the same name) is never overwritten.
 * Returns only the rows actually created this run.
 */
export async function seedNonTeachingStaff(db: PrismaClient, entries: SeedNonTeachingStaffEntry[]) {
  const created: Awaited<ReturnType<typeof createNonTeachingStaffFromSeed>>[] = [];
  for (const entry of entries) {
    const existing = await db.nonTeachingStaff.findFirst({ where: { name: entry.name } });
    if (existing) continue;
    created.push(await createNonTeachingStaffFromSeed(db, entry));
  }

  if (created.length > 0) {
    const flags = await getSetting(db, "staff.importFlags");
    const next = { ...flags };
    for (const row of created) next[row.id] = true;
    await setSetting(db, "staff.importFlags", next, null);
  }

  return created;
}

async function createNonTeachingStaffFromSeed(db: PrismaClient, entry: SeedNonTeachingStaffEntry) {
  const max = await db.nonTeachingStaff.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;
  return db.nonTeachingStaff.create({
    data: { name: entry.name, position: entry.position, order, showContact: false },
  });
}
