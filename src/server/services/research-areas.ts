import "server-only";
import { z } from "zod";
import type { ContentStatus, PrismaClient } from "@prisma/client";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";
import { generateUniqueSlug } from "@/lib/slugify";

const researchAreaInputSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  body: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  imageId: z.string().nullable(),
});
export type ResearchAreaInput = z.infer<typeof researchAreaInputSchema>;

export async function listResearchAreasAdmin(db: PrismaClient) {
  return db.researchArea.findMany({ orderBy: { order: "asc" }, include: { image: true } });
}

export async function getResearchAreaBySlugAdmin(db: PrismaClient, slug: string) {
  return db.researchArea.findUnique({
    where: { slug },
    include: { image: true, lecturers: { select: { id: true, fullName: true, slug: true, status: true } } },
  });
}

/** Public-safe: only PUBLISHED areas, in admin-defined order. */
export async function listResearchAreasPublic(db: PrismaClient) {
  try {
    return await db.researchArea.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { order: "asc" },
      include: { image: true },
    });
  } catch {
    return [];
  }
}

/** Public-safe: null unless the area is PUBLISHED. Attached lecturers are
 * filtered to published, non-emeritus profiles only. */
export async function getResearchAreaBySlugPublic(db: PrismaClient, slug: string) {
  try {
    const area = await db.researchArea.findUnique({
      where: { slug },
      include: {
        image: true,
        lecturers: {
          where: { status: "PUBLISHED", isEmeritus: false },
          orderBy: { order: "asc" },
          include: { photo: true },
        },
      },
    });
    if (!area || area.status !== "PUBLISHED") return null;
    return area;
  } catch {
    return null;
  }
}

/** For the archived-slug-redirects-to-/research rule: looks up a slug regardless of status. */
export async function getResearchAreaStatusBySlug(db: PrismaClient, slug: string): Promise<ContentStatus | null> {
  try {
    const area = await db.researchArea.findUnique({ where: { slug }, select: { status: true } });
    return area?.status ?? null;
  } catch {
    return null;
  }
}

export async function createResearchArea(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = researchAreaInputSchema.parse(input);
  const slug = await generateUniqueSlug(parsed.title, async (candidate) => {
    const existing = await db.researchArea.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });
  const max = await db.researchArea.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;

  return db.$transaction(async (tx) => {
    const created = await tx.researchArea.create({ data: { ...parsed, slug, order } });
    await createRevision(tx, { entityType: "ResearchArea", entityId: created.id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "research_area.create", entityType: "ResearchArea", entityId: created.id, summary: `Created ${created.title}` },
      context,
    );
    return created;
  });
}

export async function updateResearchArea(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = researchAreaInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const updated = await tx.researchArea.update({ where: { id }, data: parsed });
    await createRevision(tx, { entityType: "ResearchArea", entityId: id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "research_area.update", entityType: "ResearchArea", entityId: id, summary: `Updated ${updated.title}` },
      context,
    );
    return updated;
  });
}

export async function setResearchAreaStatus(
  db: PrismaClient,
  id: string,
  status: ContentStatus,
  actorId: string,
  context?: AuditRequestContext,
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.researchArea.update({ where: { id }, data: { status } });
    await logAction(
      tx,
      { actorId, action: "research_area.set_status", entityType: "ResearchArea", entityId: id, summary: `Set ${updated.title} to ${status}` },
      context,
    );
    return updated;
  });
}

/** Swaps `order` with the adjacent sibling; a no-op at either boundary or with one item. */
export async function reorderResearchArea(db: PrismaClient, id: string, direction: "up" | "down"): Promise<void> {
  const target = await db.researchArea.findUniqueOrThrow({ where: { id } });
  const siblings = await db.researchArea.findMany({ orderBy: { order: "asc" } });

  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.researchArea.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.researchArea.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}
