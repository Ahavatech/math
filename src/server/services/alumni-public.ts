import "server-only";
import type { PrismaClient } from "@prisma/client";
import { matchesSearch } from "@/lib/text-search";

const PUBLIC_SELECT = {
  id: true,
  fullName: true,
  organisation: true,
  roleOrField: true,
  city: true,
  country: true,
  note: true,
  isFeatured: true,
  consentPublicDisplay: true,
  photo: { select: { id: true, url: true, alt: true } },
  programmes: {
    select: { level: true, entryYear: true, graduationYear: true },
    orderBy: { graduationYear: "asc" as const },
  },
} as const;

const PER_PAGE_DEFAULT = 24;

export async function listApprovedAlumni(
  db: PrismaClient,
  options: {
    page: number;
    perPage?: number;
    year?: number;
    level?: "BSC" | "MSC" | "PHD";
    country?: string;
    q?: string;
  },
) {
  try {
    const perPage = options.perPage ?? PER_PAGE_DEFAULT;

    const programmeFilter =
      options.year || options.level
        ? {
            some: {
              ...(options.level ? { level: options.level } : {}),
              ...(options.year ? { graduationYear: options.year } : {}),
            },
          }
        : undefined;

    const where = {
      status: "APPROVED" as const,
      consentPublicDisplay: true,
      ...(programmeFilter ? { programmes: programmeFilter } : {}),
      ...(options.country ? { country: options.country } : {}),
    };

    const all = await db.alumniEntry.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: [{ fullName: "asc" }],
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
    return await db.alumniEntry.count({ where: { status: "APPROVED", consentPublicDisplay: true } });
  } catch {
    return 0;
  }
}

export async function listFeaturedAlumni(db: PrismaClient, limit = 3) {
  try {
    const featured = await db.alumniEntry.findMany({
      where: { status: "APPROVED", isFeatured: true, consentPublicDisplay: true },
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

/** Safe subset of fields returned in suggestions -- no email, no photo, no note. */
const SUGGESTION_SELECT = {
  id: true,
  fullName: true,
  organisation: true,
  roleOrField: true,
  city: true,
  country: true,
  programmes: {
    select: { level: true, graduationYear: true },
    orderBy: { graduationYear: "asc" as const },
  },
} as const;

/**
 * Returns up to 12 approved, consented alumni per graduation-year group that
 * overlaps with the given entry's programmes. Matching rules (per spec):
 * 1. Same programme level AND same graduation year, ordered by fullName asc.
 * 2. If fewer than 3 found, fill from any level for the same graduation year.
 * 3. Cap each group at 12, deterministic by fullName asc.
 * Groups are keyed by graduation year; for multi-programme entries, one group
 * per graduation year.
 */
export async function getPeopleYouMightKnow(
  db: PrismaClient,
  entryId: string,
): Promise<Record<string, typeof SUGGESTION_SELECT extends object ? unknown[] : never>> {
  const entry = await db.alumniEntry.findUnique({
    where: { id: entryId },
    select: { programmes: { select: { level: true, graduationYear: true } } },
  });
  if (!entry || !entry.programmes.length) return {};

  const result: Record<string, unknown[]> = {};

  for (const prog of entry.programmes) {
    const key = `${prog.level}-${prog.graduationYear}`;

    // Primary: same level + same graduation year
    const primary = await db.alumniEntry.findMany({
      where: {
        status: "APPROVED",
        consentPublicDisplay: true,
        id: { not: entryId },
        programmes: { some: { level: prog.level, graduationYear: prog.graduationYear } },
      },
      select: SUGGESTION_SELECT,
      orderBy: { fullName: "asc" },
      take: 12,
    });

    if (primary.length >= 3) {
      result[key] = primary;
      continue;
    }

    // Fill: any level, same graduation year
    const existing = new Set(primary.map((e) => e.id));
    const fill = await db.alumniEntry.findMany({
      where: {
        status: "APPROVED",
        consentPublicDisplay: true,
        id: { not: entryId },
        programmes: { some: { graduationYear: prog.graduationYear } },
      },
      select: SUGGESTION_SELECT,
      orderBy: { fullName: "asc" },
    });

    const combined = [
      ...primary,
      ...fill.filter((e) => !existing.has(e.id)),
    ].slice(0, 12);

    result[key] = combined;
  }

  return result as Record<string, unknown[]>;
}
