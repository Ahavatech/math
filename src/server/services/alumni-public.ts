import "server-only";
import type { PrismaClient } from "@prisma/client";
import { matchesSearch } from "@/lib/text-search";

const PUBLIC_SELECT = {
  id: true,
  fullName: true,
  level: true,
  graduationYear: true,
  organisation: true,
  roleTitle: true,
  city: true,
  country: true,
  industry: true,
  linkedinUrl: true,
  isFeatured: true,
  photo: { select: { id: true, url: true, alt: true } },
} as const;

const PER_PAGE_DEFAULT = 24;

export async function listApprovedAlumni(
  db: PrismaClient,
  options: { page: number; perPage?: number; year?: number; level?: "BSC" | "MSC"; country?: string; industry?: string; q?: string },
) {
  try {
    const perPage = options.perPage ?? PER_PAGE_DEFAULT;
    const where = {
      status: "APPROVED" as const,
      ...(options.year ? { graduationYear: options.year } : {}),
      ...(options.level ? { level: options.level } : {}),
      ...(options.country ? { country: options.country } : {}),
      ...(options.industry ? { industry: options.industry } : {}),
    };

    // The name search is diacritic-insensitive (src/lib/text-search.ts), which
    // Postgres can't do directly, so it's applied in application code; every
    // other filter is a real `where` clause, and pagination still happens
    // after the search filter so page counts stay correct.
    const all = await db.alumniEntry.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: [{ graduationYear: "desc" }, { fullName: "asc" }],
    });

    const filtered = options.q ? all.filter((e) => matchesSearch(e.fullName, options.q!)) : all;
    const total = filtered.length;
    const start = (options.page - 1) * perPage;
    const entries = filtered.slice(start, start + perPage);

    return { entries, total };
  } catch {
    return { entries: [], total: 0 };
  }
}

export async function countApprovedAlumni(db: PrismaClient): Promise<number> {
  try {
    return await db.alumniEntry.count({ where: { status: "APPROVED" } });
  } catch {
    return 0;
  }
}

/**
 * Up to `limit` featured entries. When more than `limit` are featured,
 * rotates deterministically by calendar day (UTC) - same technique as
 * src/lib/featured-lecturer.ts's single pick, generalised to a window
 * of `limit` entries starting at a day-derived offset, so the set
 * changes daily without needing to store anything.
 */
export async function listFeaturedAlumni(db: PrismaClient, limit = 3) {
  try {
    const featured = await db.alumniEntry.findMany({
      where: { status: "APPROVED", isFeatured: true },
      select: PUBLIC_SELECT,
      orderBy: { id: "asc" },
    });

    if (featured.length <= limit) return featured;

    const dayNumber = Math.floor(Date.now() / 86_400_000);
    const start = dayNumber % featured.length;
    return Array.from({ length: limit }, (_, i) => featured[(start + i) % featured.length]);
  } catch {
    return [];
  }
}
