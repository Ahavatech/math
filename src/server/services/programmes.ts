import "server-only";
import { z } from "zod";
import type { PrismaClient, ProgrammeLevel } from "@prisma/client";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";

export const programmeUpdateSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  body: z.string(),
  duration: z.string().min(1),
  admissionRequirements: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
export type ProgrammeUpdateInput = z.infer<typeof programmeUpdateSchema>;

const specialisationSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
});

export async function listProgrammesAdmin(db: PrismaClient) {
  return db.programme.findMany({ orderBy: { level: "asc" } });
}

/** Public-safe: only active specialisations, in display order. */
export async function getProgrammeByLevel(db: PrismaClient, level: ProgrammeLevel) {
  try {
    return await db.programme.findFirst({
      where: { level },
      include: { specialisations: { where: { isActive: true }, orderBy: { order: "asc" } } },
    });
  } catch {
    return null;
  }
}

export async function getProgrammeById(db: PrismaClient, id: string) {
  return db.programme.findUniqueOrThrow({
    where: { id },
    include: { specialisations: { orderBy: { order: "asc" } } },
  });
}

export async function updateProgramme(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = programmeUpdateSchema.parse(input);
  return db.$transaction(async (tx) => {
    const updated = await tx.programme.update({ where: { id }, data: parsed });
    await createRevision(tx, { entityType: "Programme", entityId: id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "programme.update", entityType: "Programme", entityId: id, summary: `Updated ${updated.title}` },
      context,
    );
    return updated;
  });
}

export async function createSpecialisation(
  db: PrismaClient,
  programmeId: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = specialisationSchema.parse(input);
  const max = await db.specialisation.aggregate({ where: { programmeId }, _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;

  return db.$transaction(async (tx) => {
    const created = await tx.specialisation.create({ data: { programmeId, ...parsed, order } });
    await logAction(
      tx,
      { actorId, action: "specialisation.create", entityType: "Specialisation", entityId: created.id, summary: `Created ${created.title}` },
      context,
    );
    return created;
  });
}

export async function updateSpecialisation(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = specialisationSchema.parse(input);
  return db.$transaction(async (tx) => {
    const updated = await tx.specialisation.update({ where: { id }, data: parsed });
    await logAction(
      tx,
      { actorId, action: "specialisation.update", entityType: "Specialisation", entityId: id, summary: `Updated ${updated.title}` },
      context,
    );
    return updated;
  });
}

export async function setSpecialisationActive(
  db: PrismaClient,
  id: string,
  isActive: boolean,
  actorId: string,
  context?: AuditRequestContext,
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.specialisation.update({ where: { id }, data: { isActive } });
    await logAction(
      tx,
      {
        actorId,
        action: isActive ? "specialisation.restore" : "specialisation.archive",
        entityType: "Specialisation",
        entityId: id,
        summary: `${isActive ? "Restored" : "Archived"} ${updated.title}`,
      },
      context,
    );
    return updated;
  });
}

/** Swaps `order` with the adjacent active sibling; a no-op at either boundary or with one item. */
export async function reorderSpecialisation(db: PrismaClient, id: string, direction: "up" | "down"): Promise<void> {
  const target = await db.specialisation.findUniqueOrThrow({ where: { id } });
  const siblings = await db.specialisation.findMany({
    where: { programmeId: target.programmeId, isActive: true },
    orderBy: { order: "asc" },
  });

  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.specialisation.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.specialisation.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}
