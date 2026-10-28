import "server-only";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { normalizeSearchText } from "@/lib/search-text";

export type SearchResultType =
  | "news"
  | "event"
  | "lecturer"
  | "staff"
  | "programme"
  | "research"
  | "course"
  | "handbook"
  | "download"
  | "calendar"
  | "journal_issue"
  | "article";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  snippet: string;
  url: string;
  date: Date | null;
}

export interface SearchResults {
  results: SearchResult[];
  total: number;
  page: number;
  perPage: number;
  query: string;
}

const PER_PAGE = 20;

/** Validate the raw query string: 2-100 chars, non-empty after trim. */
export function validateSearchQuery(q: string): string | null {
  const trimmed = q.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return null;
  return trimmed;
}

/** Build a safe snippet from plain text, up to maxLen chars, centered on a match. */
function makeSnippet(text: string, query: string, maxLen = 160): string {
  const plain = normalizeSearchText(text).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  const lower = plain.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let idx = -1;
  for (const w of words) {
    idx = lower.indexOf(w);
    if (idx >= 0) break;
  }
  if (idx < 0) return plain.slice(0, maxLen) + (plain.length > maxLen ? "..." : "");
  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, start + maxLen);
  const snippet = plain.slice(start, end);
  return (start > 0 ? "..." : "") + snippet + (end < plain.length ? "..." : "");
}

export async function siteSearch(
  db: PrismaClient,
  rawQuery: string,
  options: { page?: number; type?: SearchResultType } = {},
): Promise<SearchResults> {
  const q = validateSearchQuery(rawQuery);
  if (!q) return { results: [], total: 0, page: 1, perPage: PER_PAGE, query: rawQuery };

  const page = Math.max(1, options.page ?? 1);
  const perPage = PER_PAGE;

  // Build a tsquery; websearch_to_tsquery handles phrase quoting and + - operators safely.
  // We run individual type queries in parallel and merge + sort by rank.

  const allResults: SearchResult[] = [];

  await Promise.all([
    searchNews(db, q, allResults),
    searchEvents(db, q, allResults),
    searchLecturers(db, q, allResults),
    searchStaff(db, q, allResults),
    searchProgrammes(db, q, allResults),
    searchResearchAreas(db, q, allResults),
    searchCourses(db, q, allResults),
    searchHandbook(db, q, allResults),
    searchDownloads(db, q, allResults),
    searchCalendar(db, q, allResults),
    searchJournalIssues(db, q, allResults),
    searchArticles(db, q, allResults),
  ]);

  // Filter by type if requested
  const filtered = options.type
    ? allResults.filter((r) => r.type === options.type)
    : allResults;

  const total = filtered.length;
  const start = (page - 1) * perPage;
  const results = filtered.slice(start, start + perPage);

  return { results, total, page, perPage, query: q };
}

// ---------------------------------------------------------------------------
// Per-type searchers
// ---------------------------------------------------------------------------

type RawRow = Record<string, unknown>;

async function searchNews(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, title, excerpt, "publishedAt",
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "NewsPost"
      WHERE status = 'PUBLISHED'
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 50
    `);
    for (const r of rows) {
      out.push({
        type: "news",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.excerpt as string) || (r.title as string), q),
        url: `/news/${r.id}`,
        date: r.publishedAt ? new Date(r.publishedAt as string) : null,
      });
    }
  } catch {
    // silently skip this type on error
  }
}

async function searchEvents(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, slug, title, description, "startsAt",
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "Event"
      WHERE status = 'PUBLISHED'
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 50
    `);
    for (const r of rows) {
      out.push({
        type: "event",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.description as string) || (r.title as string), q),
        url: `/events/${r.slug}`,
        date: r.startsAt ? new Date(r.startsAt as string) : null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchLecturers(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, slug, "fullName", bio,
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "LecturerProfile"
      WHERE status = 'PUBLISHED'
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 50
    `);
    for (const r of rows) {
      out.push({
        type: "lecturer",
        id: r.id as string,
        title: r.fullName as string,
        snippet: makeSnippet((r.bio as string) || (r.fullName as string), q),
        url: `/lecturer/${r.slug}`,
        date: null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchStaff(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, name, position,
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "NonTeachingStaff"
      WHERE "isActive" = true
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 50
    `);
    for (const r of rows) {
      out.push({
        type: "staff",
        id: r.id as string,
        title: r.name as string,
        snippet: (r.position as string) || "",
        url: `/staff`,
        date: null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchProgrammes(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, slug, title, summary,
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "Programme"
      WHERE status = 'PUBLISHED'
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 20
    `);
    for (const r of rows) {
      out.push({
        type: "programme",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.summary as string) || (r.title as string), q),
        url: `/programmes`,
        date: null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchResearchAreas(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, slug, title, summary,
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "ResearchArea"
      WHERE status = 'PUBLISHED'
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 20
    `);
    for (const r of rows) {
      out.push({
        type: "research",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.summary as string) || (r.title as string), q),
        url: `/research/${r.slug}`,
        date: null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchCourses(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, code, slug, title, "searchText",
             ts_rank(to_tsvector('english', "searchText"), websearch_to_tsquery('english', ${q})) AS rank
      FROM "Course"
      WHERE status = 'PUBLISHED'
        AND (
          to_tsvector('english', "searchText") @@ websearch_to_tsquery('english', ${q})
          OR code ILIKE ${`%${q}%`}
        )
      ORDER BY rank DESC
      LIMIT 50
    `);
    for (const r of rows) {
      out.push({
        type: "course",
        id: r.id as string,
        title: `${r.code} ${r.title}`,
        snippet: makeSnippet((r.searchText as string) || (r.title as string), q),
        url: `/students/courses/${r.slug}`,
        date: null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchHandbook(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, slug, title, summary, "searchText",
             ts_rank(to_tsvector('english', "searchText"), websearch_to_tsquery('english', ${q})) AS rank
      FROM "HandbookPage"
      WHERE status = 'PUBLISHED'
        AND to_tsvector('english', "searchText") @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 30
    `);
    for (const r of rows) {
      out.push({
        type: "handbook",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.summary as string) || (r.searchText as string) || (r.title as string), q),
        url: `/students/handbook/${r.slug}`,
        date: null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchDownloads(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, title, description, category, "createdAt",
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "Download"
      WHERE status = 'PUBLISHED'
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 30
    `);
    for (const r of rows) {
      out.push({
        type: "download",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.description as string) || (r.category as string) || (r.title as string), q),
        url: `/students/downloads`,
        date: r.createdAt ? new Date(r.createdAt as string) : null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchCalendar(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, title, description, "startDate",
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "AcademicCalendarEntry"
      WHERE "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 30
    `);
    for (const r of rows) {
      out.push({
        type: "calendar",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.description as string) || (r.title as string), q),
        url: `/students/calendar`,
        date: r.startDate ? new Date(r.startDate as string) : null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchJournalIssues(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT id, volume, number, title, description, "publishedAt",
             ts_rank("searchVec", websearch_to_tsquery('english', ${q})) AS rank
      FROM "JournalIssue"
      WHERE status = 'PUBLISHED'
        AND "searchVec" @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 20
    `);
    for (const r of rows) {
      out.push({
        type: "journal_issue",
        id: r.id as string,
        title: (r.title as string) || `Vol. ${r.volume} No. ${r.number}`,
        snippet: makeSnippet((r.description as string) || (r.title as string) || "", q),
        url: `/journal/issues/${r.volume}/${r.number}`,
        date: r.publishedAt ? new Date(r.publishedAt as string) : null,
      });
    }
  } catch {
    /* skip */
  }
}

async function searchArticles(db: PrismaClient, q: string, out: SearchResult[]) {
  try {
    const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT a.id, a.slug, a.title, a.abstract, a."publishedAt", a.status,
             a."searchText",
             ts_rank(to_tsvector('english', a."searchText"), websearch_to_tsquery('english', ${q})) AS rank
      FROM "Article" a
      LEFT JOIN "JournalIssue" ji ON ji.id = a."issueId"
      WHERE a.status IN ('PUBLISHED', 'CORRECTED', 'RETRACTED')
        AND (a."issueId" IS NULL OR ji.status = 'PUBLISHED')
        AND to_tsvector('english', a."searchText") @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 50
    `);
    for (const r of rows) {
      out.push({
        type: "article",
        id: r.id as string,
        title: r.title as string,
        snippet: makeSnippet((r.abstract as string) || (r.searchText as string) || (r.title as string), q),
        url: `/journal/articles/${r.slug}`,
        date: r.publishedAt ? new Date(r.publishedAt as string) : null,
      });
    }
  } catch {
    /* skip */
  }
}
