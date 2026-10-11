import "server-only";
import type { ContentStatus, PrismaClient } from "@prisma/client";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";
import { generateUniqueSlug } from "@/lib/slugify";
import { newsPostInputSchema } from "@/lib/validators/news";

export async function listNewsPostsAdmin(db: PrismaClient) {
  return db.newsPost.findMany({ orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }], include: { cover: true } });
}

export async function getNewsPostBySlugAdmin(db: PrismaClient, slug: string) {
  return db.newsPost.findUnique({ where: { slug }, include: { cover: true } });
}

export async function getNewsPostByIdAdmin(db: PrismaClient, id: string) {
  return db.newsPost.findUniqueOrThrow({ where: { id }, include: { cover: true } });
}

export async function createNewsPost(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = newsPostInputSchema.parse(input);
  const slug = await generateUniqueSlug(parsed.title, async (candidate) => {
    const existing = await db.newsPost.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  return db.$transaction(async (tx) => {
    const created = await tx.newsPost.create({ data: { ...parsed, slug, authorId: actorId } });
    await createRevision(tx, { entityType: "NewsPost", entityId: created.id, snapshot: { ...parsed, slug }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "news.create", entityType: "NewsPost", entityId: created.id, summary: `Created ${created.title}` },
      context,
    );
    return created;
  });
}

export async function updateNewsPost(
  db: PrismaClient,
  id: string,
  input: Record<string, unknown> & { slug: string },
  actorId: string,
  context?: AuditRequestContext,
) {
  const { slug: nextSlug, ...rest } = input as { slug: string } & Record<string, unknown>;
  const parsed = newsPostInputSchema.parse(rest);
  const existing = await db.newsPost.findUniqueOrThrow({ where: { id } });

  const previousSlugs =
    nextSlug !== existing.slug
      ? Array.from(new Set([...existing.previousSlugs, existing.slug]))
      : existing.previousSlugs;

  return db.$transaction(async (tx) => {
    const updated = await tx.newsPost.update({
      where: { id },
      data: { ...parsed, slug: nextSlug, previousSlugs },
    });
    await createRevision(tx, { entityType: "NewsPost", entityId: id, snapshot: { ...parsed, slug: nextSlug }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "news.update", entityType: "NewsPost", entityId: id, summary: `Updated ${updated.title}` },
      context,
    );
    return updated;
  });
}

export async function setNewsPostStatus(
  db: PrismaClient,
  id: string,
  status: ContentStatus,
  actorId: string,
  context?: AuditRequestContext,
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.newsPost.update({ where: { id }, data: { status } });
    await logAction(
      tx,
      { actorId, action: "news.set_status", entityType: "NewsPost", entityId: id, summary: `Set ${updated.title} to ${status}` },
      context,
    );
    return updated;
  });
}

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  category: true,
  excerpt: true,
  body: true,
  isPinned: true,
  publishedAt: true,
  cover: { select: { id: true, url: true, alt: true } },
} as const;

/** Public-safe: PUBLISHED and already-past publishedAt only, pinned first then newest first. */
export async function listNewsPostsPublic(
  db: PrismaClient,
  options: { page: number; perPage: number; category?: string },
) {
  try {
    const where = {
      status: "PUBLISHED" as const,
      publishedAt: { lte: new Date() },
      ...(options.category ? { category: options.category as never } : {}),
    };
    const [posts, total] = await Promise.all([
      db.newsPost.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        skip: (options.page - 1) * options.perPage,
        take: options.perPage,
      }),
      db.newsPost.count({ where }),
    ]);
    return { posts, total };
  } catch {
    return { posts: [], total: 0 };
  }
}

export async function getPublishedNewsPostBySlug(db: PrismaClient, slug: string) {
  try {
    const post = await db.newsPost.findUnique({
      where: { slug },
      select: { ...PUBLIC_SELECT, status: true },
    });
    if (!post || post.status !== "PUBLISHED" || post.publishedAt === null || post.publishedAt > new Date()) {
      return null;
    }
    const { status: _status, ...publicFields } = post;
    return publicFields;
  } catch {
    return null;
  }
}

export async function listLatestNewsPublic(db: PrismaClient, limit: number) {
  try {
    return await db.newsPost.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      select: PUBLIC_SELECT,
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: limit,
    });
  } catch {
    return [];
  }
}

/** For the "More news" block: other published posts, excluding the current one. */
export async function listOtherNewsPublic(db: PrismaClient, excludeId: string, limit: number) {
  try {
    return await db.newsPost.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, id: { not: excludeId } },
      select: PUBLIC_SELECT,
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

/** Looks up a slug regardless of status, for the previousSlugs redirect. */
export async function findNewsPostBySlugOrPrevious(db: PrismaClient, slug: string) {
  try {
    const direct = await db.newsPost.findUnique({ where: { slug }, select: { slug: true, status: true } });
    if (direct) return { post: direct, redirectTo: null as string | null };

    const viaPrevious = await db.newsPost.findFirst({
      where: { previousSlugs: { has: slug } },
      select: { slug: true, status: true },
    });
    if (viaPrevious) return { post: viaPrevious, redirectTo: viaPrevious.slug };

    return null;
  } catch {
    return null;
  }
}
