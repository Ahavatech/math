import "server-only";
import { db } from "@/lib/db";

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

export async function listLatestNews(limit = 3) {
  try {
    return await db.newsPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function listUpcomingEvents(limit = 3) {
  try {
    return await db.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function getFeaturedLecturer() {
  try {
    return await db.lecturerProfile.findFirst({
      where: { status: "PUBLISHED", isEmeritus: false },
      orderBy: { order: "asc" },
      include: { photo: true },
    });
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
