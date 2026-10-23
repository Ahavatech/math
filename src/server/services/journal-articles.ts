import "server-only";
import type { PrismaClient } from "@prisma/client";
import { ArticleStatus } from "@prisma/client";
import { articleInputSchema, normalizeKeywords } from "@/lib/validators/journal";
import { normalizeSearchText } from "@/lib/search-text";
import { generateUniqueSlug } from "@/lib/slugify";
import { createRevision, listRevisions } from "@/server/services/revisions";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

function computeSearchText(title: string, abstract: string, keywords: string[]): string {
  return normalizeSearchText([title, abstract, ...keywords].join(" "));
}

export async function listArticlesAdmin(db: PrismaClient) {
  return db.article.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { issue: { select: { volume: true, number: true, status: true } }, authors: { orderBy: { order: "asc" } } },
  });
}

export async function getArticleAdmin(db: PrismaClient, id: string) {
  return db.article.findUniqueOrThrow({ where: { id }, include: { authors: { orderBy: { order: "asc" } } } });
}

/** A warning aid, not a hard block: the caller decides whether to proceed anyway. */
export async function findPossibleDuplicateArticle(
  db: PrismaClient,
  title: string,
  issueId: string | null,
  excludeId?: string,
) {
  const normalizedTitle = normalizeSearchText(title);
  const candidates = await db.article.findMany({
    where: { issueId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, title: true },
  });
  return candidates.find((c) => normalizeSearchText(c.title) === normalizedTitle) ?? null;
}

type ArticleAuthorInput = {
  name: string;
  affiliation?: string;
  orcid?: string;
  email?: string;
  order: number;
  userId?: string | null;
};

async function slugExists(db: PrismaClient, candidate: string): Promise<boolean> {
  const found = await db.article.findUnique({ where: { slug: candidate } });
  return !!found;
}

export async function createArticle(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = articleInputSchema.parse(input);
  const keywords = normalizeKeywords(parsed.keywords);
  const slug = await generateUniqueSlug(parsed.title, (c) => slugExists(db, c));

  return db.$transaction(async (tx) => {
    const created = await tx.article.create({
      data: {
        slug,
        title: parsed.title,
        abstract: parsed.abstract,
        keywords,
        searchText: computeSearchText(parsed.title, parsed.abstract, keywords),
        issueId: parsed.issueId ?? null,
        pageStart: parsed.pageStart ?? null,
        pageEnd: parsed.pageEnd ?? null,
        type: parsed.type,
        doi: parsed.doi || null,
        license: parsed.license || null,
        receivedAt: parsed.receivedAt ? new Date(parsed.receivedAt) : null,
        acceptedAt: parsed.acceptedAt ? new Date(parsed.acceptedAt) : null,
        status: parsed.status,
        publishedAt: parsed.status === "PUBLISHED" ? new Date() : null,
        authors: {
          create: parsed.authors.map((a: ArticleAuthorInput) => ({
            name: a.name,
            affiliation: a.affiliation || null,
            orcid: a.orcid || null,
            email: a.email || null,
            order: a.order,
            userId: a.userId || null,
          })),
        },
      },
    });
    await createRevision(tx, { entityType: "Article", entityId: created.id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "journal.article.create", entityType: "Article", entityId: created.id, summary: `Created article "${created.title}"` },
      context,
    );
    return created;
  });
}

export async function updateArticle(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = articleInputSchema.parse(input);
  const existing = await db.article.findUniqueOrThrow({ where: { id } });
  const keywords = normalizeKeywords(parsed.keywords);

  // Slug is auto-derived from the title only until the article has
  // been published once; after that, the slug stays fixed so a public
  // URL (and any citation using it) never silently breaks.
  let nextSlug = existing.slug;
  if (!existing.publishedAt && parsed.title !== existing.title) {
    nextSlug = await generateUniqueSlug(parsed.title, async (c) => (await slugExists(db, c)) && c !== existing.slug);
  }

  const becomingPublished = parsed.status === "PUBLISHED" && !existing.publishedAt;

  return db.$transaction(async (tx) => {
    await tx.articleAuthor.deleteMany({ where: { articleId: id } });
    const updated = await tx.article.update({
      where: { id },
      data: {
        slug: nextSlug,
        title: parsed.title,
        abstract: parsed.abstract,
        keywords,
        searchText: computeSearchText(parsed.title, parsed.abstract, keywords),
        issueId: parsed.issueId ?? null,
        pageStart: parsed.pageStart ?? null,
        pageEnd: parsed.pageEnd ?? null,
        type: parsed.type,
        doi: parsed.doi || null,
        license: parsed.license || null,
        receivedAt: parsed.receivedAt ? new Date(parsed.receivedAt) : null,
        acceptedAt: parsed.acceptedAt ? new Date(parsed.acceptedAt) : null,
        status: parsed.status,
        publishedAt: becomingPublished ? new Date() : existing.publishedAt,
        authors: {
          create: parsed.authors.map((a: ArticleAuthorInput) => ({
            name: a.name,
            affiliation: a.affiliation || null,
            orcid: a.orcid || null,
            email: a.email || null,
            order: a.order,
            userId: a.userId || null,
          })),
        },
      },
    });
    await createRevision(tx, { entityType: "Article", entityId: updated.id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "journal.article.update", entityType: "Article", entityId: updated.id, summary: `Updated article "${updated.title}"` },
      context,
    );
    return updated;
  });
}

export async function setArticleStatus(
  db: PrismaClient,
  id: string,
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CORRECTED" | "RETRACTED",
  actorId: string,
  context?: AuditRequestContext,
) {
  const existing = await db.article.findUniqueOrThrow({ where: { id } });
  const becomingPublished = status === "PUBLISHED" && !existing.publishedAt;
  return db.$transaction(async (tx) => {
    const updated = await tx.article.update({
      where: { id },
      data: { status, publishedAt: becomingPublished ? new Date() : existing.publishedAt },
    });
    await logAction(
      tx,
      { actorId, action: "journal.article.set_status", entityType: "Article", entityId: id, summary: `Set "${updated.title}" to ${status}` },
      context,
    );
    return updated;
  });
}

export async function listArticleRevisions(db: PrismaClient, id: string) {
  return listRevisions(db, "Article", id);
}

export type PublishingChecklistItem = { label: string; met: boolean };

/** Publishing requires: title, abstract, at least one author, a verified PDF. */
export async function getPublishingChecklist(
  db: PrismaClient,
  id: string,
): Promise<PublishingChecklistItem[]> {
  const article = await db.article.findUniqueOrThrow({
    where: { id },
    include: { authors: true, pdf: true },
  });
  return [
    { label: "Title", met: article.title.trim().length > 0 },
    { label: "Abstract", met: article.abstract.trim().length > 0 },
    { label: "At least one author", met: article.authors.length > 0 },
    { label: "PDF uploaded and verified", met: !!article.pdf },
  ];
}

const PUBLIC_STATUSES: ArticleStatus[] = [ArticleStatus.PUBLISHED, ArticleStatus.CORRECTED, ArticleStatus.RETRACTED];

/**
 * An article is public when its status is PUBLISHED, CORRECTED, or RETRACTED
 * AND (it has no issue, i.e. online-first) or its issue is also PUBLISHED.
 * Retracted articles keep their page with a notice (Decision 76).
 */
export function isArticlePublic(article: { status: string; issue: { status: string } | null }): boolean {
  if (!PUBLIC_STATUSES.includes(article.status as ArticleStatus)) return false;
  if (!article.issue) return true;
  return article.issue.status === "PUBLISHED";
}

const PUBLIC_ARTICLE_SELECT = {
  id: true,
  slug: true,
  title: true,
  abstract: true,
  keywords: true,
  subjectArea: true,
  pageStart: true,
  pageEnd: true,
  articleNumber: true,
  type: true,
  doi: true,
  license: true,
  receivedAt: true,
  acceptedAt: true,
  publishedAt: true,
  status: true,
  retractionReason: true,
  notices: true,
  issueId: true,
  pdfDownloadId: true,
  issue: { select: { id: true, volume: true, number: true, year: true, status: true } },
  authors: {
    orderBy: { order: "asc" as const },
    select: { id: true, name: true, affiliation: true, orcid: true, isCorresponding: true, order: true },
  },
} as const;

export async function listArticlesPublic(db: PrismaClient, params: { page?: number; perPage?: number; year?: number; type?: string; query?: string } = {}) {
  try {
    const perPage = params.perPage ?? 20;
    const page = params.page ?? 1;
    const normalizedQuery = params.query ? normalizeSearchText(params.query) : null;

    const where = {
      status: { in: PUBLIC_STATUSES },
      OR: [{ issueId: null }, { issue: { status: "PUBLISHED" as const } }],
      ...(params.year ? { issue: { year: params.year, status: "PUBLISHED" as const } } : {}),
      ...(params.type ? { type: params.type as never } : {}),
      ...(normalizedQuery ? { searchText: { contains: normalizedQuery } } : {}),
    };

    const [articles, total] = await Promise.all([
      db.article.findMany({
        where,
        select: PUBLIC_ARTICLE_SELECT,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.article.count({ where }),
    ]);

    return { articles, total, page, perPage };
  } catch {
    return { articles: [], total: 0, page: 1, perPage: params.perPage ?? 20 };
  }
}

export async function getArticleBySlugPublic(db: PrismaClient, slug: string) {
  try {
    const article = await db.article.findFirst({
      where: { slug, status: { in: PUBLIC_STATUSES } },
      select: PUBLIC_ARTICLE_SELECT,
    });
    if (!article) return null;
    if (article.issueId && article.issue?.status !== "PUBLISHED") return null;
    return article;
  } catch {
    return null;
  }
}

/** Looks up a slug regardless of status, for the previousSlugs redirect. */
export async function findArticleBySlugOrPrevious(db: PrismaClient, slug: string) {
  try {
    const direct = await db.article.findUnique({ where: { slug }, select: { slug: true, status: true, issue: { select: { status: true } } } });
    if (direct) return { article: direct, redirectTo: null as string | null };

    const viaPrevious = await db.article.findFirst({
      where: { previousSlugs: { has: slug } },
      select: { slug: true },
    });
    if (viaPrevious) return { article: null, redirectTo: viaPrevious.slug };

    return null;
  } catch {
    return null;
  }
}

/** Returns the Cloudinary file URL and a clean citation filename for a public, published article's PDF. */
export async function getArticlePdfForRoute(db: PrismaClient, slug: string) {
  const article = await db.article.findFirst({
    where: { slug, status: { in: PUBLIC_STATUSES } },
    select: {
      title: true,
      publishedAt: true,
      issue: { select: { status: true, year: true } },
      authors: { orderBy: { order: "asc" }, take: 1, select: { name: true } },
      pdf: { select: { fileUrl: true } },
    },
  });
  if (!article || !article.pdf?.fileUrl) return null;
  if (article.issue && article.issue.status !== "PUBLISHED") return null;

  const year = article.issue?.year ?? article.publishedAt?.getUTCFullYear() ?? new Date().getUTCFullYear();
  return { fileUrl: article.pdf.fileUrl, firstAuthorName: article.authors[0]?.name ?? "Article", year, title: article.title };
}

export async function listArticlesByIssuePublic(db: PrismaClient, issueId: string) {
  try {
    return await db.article.findMany({
      where: { issueId, status: { in: PUBLIC_STATUSES } },
      orderBy: { pageStart: "asc" },
      select: PUBLIC_ARTICLE_SELECT,
    });
  } catch {
    return [];
  }
}

export async function getLatestArticlesPublic(db: PrismaClient, limit = 6) {
  const { articles } = await listArticlesPublic(db, { perPage: limit, page: 1 });
  return articles;
}
