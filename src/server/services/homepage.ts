import "server-only";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { getSetting } from "@/server/services/site-settings";
import { pickAutomaticFeatured } from "@/lib/featured-lecturer";
import { listLatestNewsPublic } from "@/server/services/news";
import { listUpcomingEventsPublic } from "@/server/services/events";

/**
 * Every export here falls back to an empty/null result instead of
 * throwing, so the homepage still builds and renders when the database
 * is empty or unreachable (e.g. prerendering at build time without a
 * live database) - it then just hides the corresponding section, the
 * same as if there genuinely were no matching rows.
 */

export async function listResearchAreas(limit = 6) {
  try {
    return await db.researchArea.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { order: "asc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

/** Delegates to the news service's own scheduling-aware query (status PUBLISHED and publishedAt <= now), rather than duplicating that filter here. */
export async function listLatestNews(limit = 3) {
  return listLatestNewsPublic(db, limit);
}

/** Delegates to the events service's own isUpcoming-based query, rather than the naive "startsAt >= now" this used to do (which ignored endsAt). */
export async function listUpcomingEvents(limit = 3) {
  return listUpcomingEventsPublic(db, limit);
}

/**
 * Manual mode features the chosen profile if it is still eligible
 * (published, active account); otherwise (including automatic mode)
 * falls back to a deterministic daily pick among published, active,
 * non-emeritus profiles that have both a photo and a non-empty bio -
 * see src/lib/featured-lecturer.ts. The query orders by `id` so the
 * candidate list (and therefore the day's pick) is stable across
 * requests within the same day.
 */
export async function getFeaturedLecturer(dbClient: PrismaClient = db) {
  try {
    const setting = await getSetting(dbClient, "homepage.featuredLecturer");

    if (setting.mode === "manual" && setting.lecturerProfileId) {
      const manual = await dbClient.lecturerProfile.findFirst({
        where: { id: setting.lecturerProfileId, status: "PUBLISHED", user: { isActive: true } },
        include: { photo: true },
      });
      if (manual) return manual;
    }

    const candidates = await dbClient.lecturerProfile.findMany({
      where: {
        status: "PUBLISHED",
        isEmeritus: false,
        user: { isActive: true },
        photoId: { not: null },
      },
      orderBy: { id: "asc" },
      include: { photo: true },
    });
    const eligible = candidates.filter((c) => c.bio && c.bio.trim());
    return pickAutomaticFeatured(eligible);
  } catch {
    return null;
  }
}

export async function getFeaturedAlumni(limit = 3) {
  try {
    return await db.alumniEntry.findMany({
      where: { status: "APPROVED", isFeatured: true },
      orderBy: { reviewedAt: "desc" },
      take: limit,
      include: { photo: true },
    });
  } catch {
    return [];
  }
}

export async function getHeroImage(imageId: string | null) {
  if (!imageId) return null;
  try {
    return await db.mediaAsset.findUnique({ where: { id: imageId } });
  } catch {
    return null;
  }
}
