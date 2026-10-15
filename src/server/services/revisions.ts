import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Generic ContentRevision helpers shared by every admin-editable content
 * type (site settings, pages, programmes, research areas, and whatever
 * later stages add). See docs/PATTERNS.md.
 */
export async function createRevision(
  db: Db,
  params: { entityType: string; entityId: string; snapshot: unknown; createdById: string | null },
): Promise<void> {
  await db.contentRevision.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      snapshot: params.snapshot as Prisma.InputJsonValue,
      createdById: params.createdById,
    },
  });
}

export async function listRevisions(db: PrismaClient, entityType: string, entityId: string) {
  return db.contentRevision.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
}

export async function getRevision(db: PrismaClient, id: string) {
  return db.contentRevision.findUniqueOrThrow({ where: { id } });
}
