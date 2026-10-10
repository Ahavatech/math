import "server-only";
import { db } from "@/lib/db";

export async function listResearchAreas(limit = 6) {
  return db.researchArea.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { order: "asc" },
    take: limit,
  });
}

export async function listLatestNews(limit = 3) {
  return db.newsPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: limit,
  });
}

export async function listUpcomingEvents(limit = 3) {
  return db.event.findMany({
    where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
}

export async function getFeaturedLecturer() {
  return db.lecturerProfile.findFirst({
    where: { status: "PUBLISHED", isEmeritus: false },
    orderBy: { order: "asc" },
    include: { photo: true },
  });
}

export async function getFeaturedAlumni(limit = 3) {
  return db.alumniEntry.findMany({
    where: { status: "APPROVED", isFeatured: true },
    orderBy: { reviewedAt: "desc" },
    take: limit,
    include: { photo: true },
  });
}

export async function getHeroImage(imageId: string | null) {
  if (!imageId) return null;
  return db.mediaAsset.findUnique({ where: { id: imageId } });
}
