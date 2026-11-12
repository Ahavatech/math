/**
 * Attaches sample images (and a few clearly marked sample news posts and
 * events) to a LOCAL development database, so pages that depend on pictures
 * can be seen properly: the homepage hero, staff and HOD photos, research
 * areas, news covers, event flyers and a gallery.
 *
 *   npx tsx scripts/dev-sample-media.ts           attach the samples
 *   npx tsx scripts/dev-sample-media.ts --remove  take them out again
 *
 * The images live in public/dev-images/ (git-ignored, never deployed) and
 * are served from this site's own origin, so nothing is uploaded anywhere.
 * They are graphics and a building photo, not photographs of people: the
 * portrait slots get neutral squares until real photos are uploaded through
 * /admin. Refuses to run with NODE_ENV=production or against any database
 * that is not on localhost.
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const IMAGE_DIR = path.join(process.cwd(), "public", "dev-images");
const PUBLIC_ID_PREFIX = "dev-images/";
const ALT = "Sample image for layout testing";
const DAY = 24 * 60 * 60 * 1000;
// Pixel sizes of the files in public/dev-images, by name without the number.
const DIMENSIONS: Record<string, [number, number]> = {
  hero: [856, 642],
  research: [800, 600],
  "stand-in-square": [600, 600],
  flyer: [900, 1200],
  news: [1200, 675],
};

function refuseUnlessLocal(): string {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // fall through to the refusal below
  }
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(host)) {
    console.error("Refusing to run: this only works on a local development database (NODE_ENV not production, host localhost).");
    process.exit(1);
  }
  return url;
}

async function main() {
  const url = refuseUnlessLocal();
  const remove = process.argv.includes("--remove");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  async function asset(file: string) {
    if (!existsSync(path.join(IMAGE_DIR, file))) throw new Error(`Missing public/dev-images/${file}`);
    const publicId = `${PUBLIC_ID_PREFIX}${file}`;
    const existing = await db.mediaAsset.findFirst({ where: { publicId } });
    if (existing) return existing;
    // Real uploads record their size, and pages use it to keep proportions.
    const [width, height] = DIMENSIONS[file.replace(/-\d+\.jpg$/, "").replace(/\.jpg$/, "")] ?? [800, 600];
    return db.mediaAsset.create({
      data: { provider: "local", publicId, url: `/${publicId}`, width, height, format: "jpg", alt: ALT },
    });
  }

  async function setJson(key: string, patch: Record<string, unknown>) {
    const row = await db.siteSetting.findUnique({ where: { key } });
    if (!row) return false;
    await db.siteSetting.update({ where: { key }, data: { value: { ...(row.value as object), ...patch } as Prisma.InputJsonValue } });
    return true;
  }

  try {
    if (remove) {
      const ids = (await db.mediaAsset.findMany({ where: { publicId: { startsWith: PUBLIC_ID_PREFIX } }, select: { id: true } })).map((a) => a.id);
      await db.event.deleteMany({ where: { slug: { startsWith: "sample-" } } });
      await db.newsPost.deleteMany({ where: { slug: { startsWith: "sample-" } } });
      await db.lecturerProfile.updateMany({ where: { photoId: { in: ids } }, data: { photoId: null } });
      await db.researchArea.updateMany({ where: { imageId: { in: ids } }, data: { imageId: null } });
      for (const key of ["homepage.hero", "hod.welcomeAddress"]) {
        const row = await db.siteSetting.findUnique({ where: { key } });
        const v = row?.value as { imageId?: string | null; photoId?: string | null } | undefined;
        if (v?.imageId && ids.includes(v.imageId)) await setJson(key, { imageId: null });
        if (v?.photoId && ids.includes(v.photoId)) await setJson(key, { photoId: null });
      }
      await db.mediaAsset.deleteMany({ where: { id: { in: ids } } });
      console.log("Sample media, news posts and events removed.");
      return;
    }

    // Homepage hero and the HOD photo slot.
    const hero = await asset("hero.jpg");
    console.log("hero image:", (await setJson("homepage.hero", { imageId: hero.id })) ? "attached" : "no homepage.hero setting found");
    const hodPhoto = await asset("stand-in-square-5.jpg");
    console.log("HOD photo slot:", (await setJson("hod.welcomeAddress", { photoId: hodPhoto.id })) ? "attached" : "no hod setting found");

    // Lecturer portrait slots: neutral squares, only where there is no photo yet.
    const lecturers = await db.lecturerProfile.findMany({ where: { photoId: null }, orderBy: { createdAt: "asc" }, take: 5 });
    for (const [i, lecturer] of lecturers.entries()) {
      const photo = await asset(`stand-in-square-${(i % 5) + 1}.jpg`);
      await db.lecturerProfile.update({ where: { id: lecturer.id }, data: { photoId: photo.id } });
    }
    console.log(`lecturer photo slots filled: ${lecturers.length}`);

    // Research area images.
    const areas = await db.researchArea.findMany({ where: { imageId: null }, orderBy: { order: "asc" }, take: 4 });
    for (const [i, area] of areas.entries()) {
      const image = await asset(`research-${i + 1}.jpg`);
      await db.researchArea.update({ where: { id: area.id }, data: { imageId: image.id } });
    }
    console.log(`research area images attached: ${areas.length}`);

    // Sample news with covers.
    const news = [
      { slug: "sample-news-1", title: "[SAMPLE] New academic session opens for the department", category: "ANNOUNCEMENT" as const, cover: "news-1.jpg", pinned: true, daysAgo: 2 },
      { slug: "sample-news-2", title: "[SAMPLE] Staff and students recognised for research", category: "ACHIEVEMENT" as const, cover: "news-2.jpg", pinned: false, daysAgo: 9 },
      { slug: "sample-news-3", title: "[SAMPLE] Call for applications to the postgraduate programme", category: "ADMISSION" as const, cover: "news-3.jpg", pinned: false, daysAgo: 21 },
    ];
    for (const item of news) {
      const cover = await asset(item.cover);
      const data = {
        title: item.title,
        category: item.category,
        excerpt: "[SAMPLE] A short standfirst that shows how an excerpt reads under a headline on the news pages.",
        body: "<p>[SAMPLE] This is placeholder text for checking layout. It is not a real announcement.</p><p>A second paragraph shows the reading measure and spacing of a news post.</p>",
        coverId: cover.id,
        isPinned: item.pinned,
        status: "PUBLISHED" as const,
        publishedAt: new Date(Date.now() - item.daysAgo * DAY),
      };
      await db.newsPost.upsert({ where: { slug: item.slug }, update: data, create: { slug: item.slug, ...data } });
    }
    console.log(`sample news posts: ${news.length}`);

    // Sample events: two upcoming with flyers, one past with a gallery.
    const events = [
      { slug: "sample-event-1", title: "[SAMPLE] Departmental seminar: ideas in analysis", type: "SEMINAR" as const, flyer: "flyer-1.jpg", days: 14 },
      { slug: "sample-event-2", title: "[SAMPLE] Special lecture on mathematical modelling", type: "SPECIAL_LECTURE" as const, flyer: "flyer-2.jpg", days: 30 },
      { slug: "sample-event-3", title: "[SAMPLE] Colloquium on algebra and number theory", type: "COLLOQUIUM" as const, flyer: "flyer-3.jpg", days: -20 },
    ];
    for (const item of events) {
      const flyer = await asset(item.flyer);
      const startsAt = new Date(Date.now() + item.days * DAY);
      const data = {
        title: item.title,
        type: item.type,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
        venue: "[SAMPLE] Department seminar room",
        speakerName: "[SAMPLE] Guest speaker",
        speakerAffiliation: "[SAMPLE] Another university",
        description: "<p>[SAMPLE] Placeholder description for checking how an event page reads.</p>",
        flyerId: flyer.id,
        status: "PUBLISHED" as const,
      };
      const event = await db.event.upsert({ where: { slug: item.slug }, update: data, create: { slug: item.slug, ...data } });
      if (item.days < 0) {
        await db.eventGalleryImage.deleteMany({ where: { eventId: event.id } });
        for (const [order, file] of ["research-1.jpg", "research-2.jpg", "research-3.jpg", "research-4.jpg"].entries()) {
          const media = await asset(file);
          await db.eventGalleryImage.create({ data: { eventId: event.id, mediaId: media.id, caption: `[SAMPLE] Photo ${order + 1}`, order } });
        }
      }
    }
    console.log(`sample events: ${events.length}`);
    console.log("Done. Run `npx tsx scripts/dev-sample-media.ts --remove` to take it all out again.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
