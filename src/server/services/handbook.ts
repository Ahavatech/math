import "server-only";
import type { ContentStatus, HandbookPage, PrismaClient } from "@prisma/client";
import { generateUniqueSlug } from "@/lib/slugify";
import { normalizeSearchText } from "@/lib/search-text";
import { matchesSearch } from "@/lib/text-search";
import { handbookPageInputSchema, type HandbookPageInput } from "@/lib/validators/handbook";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";

function computeSearchText(title: string, summary: string, body: string): string {
  return normalizeSearchText(`${title} ${summary} ${body}`);
}

/** The handbook tree is capped at two levels: a new child's parent must itself be a top-level page. */
async function assertNestingAllowed(db: PrismaClient, parentId: string | null) {
  if (!parentId) return;
  const parent = await db.handbookPage.findUniqueOrThrow({ where: { id: parentId } });
  if (parent.parentId) {
    throw new Error("The handbook tree supports a maximum of two levels");
  }
}

export async function createHandbookPage(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
): Promise<HandbookPage> {
  const parsed = handbookPageInputSchema.parse(input);
  await assertNestingAllowed(db, parsed.parentId);

  const slug = await generateUniqueSlug(parsed.title, async (candidate) => {
    const existing = await db.handbookPage.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  const max = await db.handbookPage.aggregate({ where: { parentId: parsed.parentId }, _max: { order: true } });

  return db.$transaction(async (tx) => {
    const created = await tx.handbookPage.create({
      data: {
        title: parsed.title,
        summary: parsed.summary,
        body: parsed.body,
        parentId: parsed.parentId,
        status: parsed.status,
        slug,
        order: (max._max.order ?? -1) + 1,
        searchText: computeSearchText(parsed.title, parsed.summary, parsed.body),
      },
    });
    await createRevision(tx, { entityType: "HandbookPage", entityId: created.id, snapshot: { ...parsed, slug }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "handbook.create", entityType: "HandbookPage", entityId: created.id, summary: `Created ${created.title}` },
      context,
    );
    return created;
  });
}

export async function updateHandbookPage(
  db: PrismaClient,
  id: string,
  input: Partial<HandbookPageInput> & { slug: string },
  actorId: string,
  context?: AuditRequestContext,
): Promise<HandbookPage> {
  const existing = await db.handbookPage.findUniqueOrThrow({ where: { id } });
  const { slug: nextSlug, ...rest } = input;
  const parsed = handbookPageInputSchema.parse(rest);
  await assertNestingAllowed(db, parsed.parentId);

  const previousSlugs =
    nextSlug !== existing.slug ? Array.from(new Set([...existing.previousSlugs, existing.slug])) : existing.previousSlugs;

  return db.$transaction(async (tx) => {
    const updated = await tx.handbookPage.update({
      where: { id },
      data: {
        title: parsed.title,
        summary: parsed.summary,
        body: parsed.body,
        parentId: parsed.parentId,
        status: parsed.status,
        slug: nextSlug,
        previousSlugs,
        searchText: computeSearchText(parsed.title, parsed.summary, parsed.body),
      },
    });
    await createRevision(tx, { entityType: "HandbookPage", entityId: id, snapshot: { ...parsed, slug: nextSlug }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "handbook.update", entityType: "HandbookPage", entityId: id, summary: `Updated ${updated.title}` },
      context,
    );
    return updated;
  });
}

export async function setHandbookPageStatus(
  db: PrismaClient,
  id: string,
  status: ContentStatus,
  actorId: string,
  context?: AuditRequestContext,
): Promise<HandbookPage> {
  return db.$transaction(async (tx) => {
    const updated = await tx.handbookPage.update({ where: { id }, data: { status } });
    await logAction(
      tx,
      { actorId, action: "handbook.set_status", entityType: "HandbookPage", entityId: id, summary: `Set ${updated.title} to ${status}` },
      context,
    );
    return updated;
  });
}

/** Swaps `order` with the adjacent sibling (same parentId), per PATTERNS.md item 6. A no-op at either end. */
export async function reorderHandbookPage(db: PrismaClient, id: string, direction: "up" | "down"): Promise<void> {
  const target = await db.handbookPage.findUniqueOrThrow({ where: { id } });
  const siblings = await db.handbookPage.findMany({ where: { parentId: target.parentId }, orderBy: { order: "asc" } });

  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.handbookPage.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.handbookPage.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}

export async function listHandbookTreeAdmin(db: PrismaClient) {
  return db.handbookPage.findMany({ orderBy: [{ parentId: "asc" }, { order: "asc" }] });
}

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  body: true,
  parentId: true,
  order: true,
  updatedAt: true,
} as const;

export async function listHandbookTreePublic(db: PrismaClient) {
  try {
    return await db.handbookPage.findMany({
      where: { status: "PUBLISHED" },
      select: PUBLIC_SELECT,
      orderBy: [{ parentId: "asc" }, { order: "asc" }],
    });
  } catch {
    return [];
  }
}

export async function getHandbookPageBySlugPublic(db: PrismaClient, slug: string) {
  try {
    const page = await db.handbookPage.findUnique({ where: { slug }, select: { ...PUBLIC_SELECT, status: true } });
    if (!page || page.status !== "PUBLISHED") return null;
    const { status: _status, ...publicFields } = page;
    return publicFields;
  } catch {
    return null;
  }
}

/** Looks up a slug regardless of status, for the previousSlugs redirect. */
export async function findHandbookPageBySlugOrPrevious(db: PrismaClient, slug: string) {
  try {
    const direct = await db.handbookPage.findUnique({ where: { slug }, select: { slug: true, status: true } });
    if (direct) return { page: direct, redirectTo: null as string | null };

    const viaPrevious = await db.handbookPage.findFirst({
      where: { previousSlugs: { has: slug } },
      select: { slug: true, status: true },
    });
    if (viaPrevious) return { page: viaPrevious, redirectTo: viaPrevious.slug };

    return null;
  } catch {
    return null;
  }
}

/**
 * Diacritic-insensitive search over PUBLISHED pages only, title matches
 * ranked first. `searchText` is fetched to match against but stripped
 * from every returned object - it is never a public-safe field (see
 * docs/DATA-MODEL.md).
 */
export async function searchHandbookPublic(db: PrismaClient, query: string) {
  try {
    const pages = await db.handbookPage.findMany({
      where: { status: "PUBLISHED" },
      select: { ...PUBLIC_SELECT, searchText: true },
    });

    const titleMatches = pages.filter((p) => matchesSearch(p.title, query));
    const bodyOnlyMatches = pages.filter((p) => !matchesSearch(p.title, query) && matchesSearch(p.searchText, query));

    return [...titleMatches, ...bodyOnlyMatches].map(({ searchText: _searchText, ...publicFields }) => publicFields);
  } catch {
    return [];
  }
}
