/**
 * Applies the finished page text that ships with the site to an existing
 * database: the privacy notice (src/lib/privacy-notice.ts) on /privacy, and the
 * Students page intro if it still holds its old placeholder. It also removes the
 * old "needs legal review" badge from the privacy page.
 *
 *   npx tsx scripts/set-privacy-notice.ts           update if the page is still the old draft
 *   npx tsx scripts/set-privacy-notice.ts --force   replace whatever is there
 *
 * Without --force it leaves the page alone if someone has already edited it
 * in /admin/pages, so it never overwrites the department's own changes.
 * Safe to run against any database; it touches only these two pages and their review badges.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { STUDENTS_INTRO_BODY } from "../src/lib/final-copy";
import { OLD_PRIVACY_DRAFT_START, PRIVACY_NOTICE_BODY, PRIVACY_NOTICE_TITLE } from "../src/lib/privacy-notice";

/** The page is a finished notice now: take away the old "needs legal review" badge in /admin/pages. */
async function clearReviewFlag(db: PrismaClient) {
  const row = await db.siteSetting.findUnique({ where: { key: "pages.legalReviewFlags" } });
  const flags = { ...((row?.value as Record<string, boolean> | undefined) ?? {}) };
  if (!flags.privacy) return;
  delete flags.privacy;
  await db.siteSetting.update({ where: { key: "pages.legalReviewFlags" }, data: { value: flags } });
  console.log("Removed the legal-review badge from the privacy page.");
}

/**
 * The Students page used to ship with a "[PLACEHOLDER ...]" paragraph. Replace
 * it with finished text, but only if nobody has edited the page since.
 */
async function finishStudentsIntro(db: PrismaClient) {
  const page = await db.page.findUnique({ where: { slug: "students-intro" } });
  if (!page || !page.body.includes("[PLACEHOLDER")) return;
  await db.contentRevision.create({
    data: { entityType: "Page", entityId: page.id, snapshot: { title: page.title, body: page.body } },
  });
  await db.page.update({ where: { slug: "students-intro" }, data: { body: STUDENTS_INTRO_BODY } });
  const row = await db.siteSetting.findUnique({ where: { key: "pages.importFlags" } });
  const flags = { ...((row?.value as Record<string, boolean> | undefined) ?? {}) };
  if (flags["students-intro"]) {
    delete flags["students-intro"];
    await db.siteSetting.update({ where: { key: "pages.importFlags" }, data: { value: flags } });
  }
  console.log("Replaced the placeholder text on the Students page.");
}

async function main() {
  const force = process.argv.includes("--force");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await finishStudentsIntro(db);
    const page = await db.page.findUnique({ where: { slug: "privacy" } });

    if (!page) {
      await db.page.create({
        data: { slug: "privacy", title: PRIVACY_NOTICE_TITLE, body: PRIVACY_NOTICE_BODY, status: "PUBLISHED" },
      });
      console.log("Created the privacy page.");
    } else if (page.body === PRIVACY_NOTICE_BODY) {
      console.log("The privacy page already has the current text.");
      await clearReviewFlag(db);
      return;
    } else if (force || page.body.startsWith(OLD_PRIVACY_DRAFT_START)) {
      await db.contentRevision.create({
        data: { entityType: "Page", entityId: page.id, snapshot: { title: page.title, body: page.body } },
      });
      await db.page.update({ where: { slug: "privacy" }, data: { title: PRIVACY_NOTICE_TITLE, body: PRIVACY_NOTICE_BODY } });
      console.log(force ? "Replaced the privacy page text (--force)." : "Replaced the old draft with the current text.");
    } else {
      console.log("The privacy page has been edited since it was seeded. Left it alone. Use --force to replace it.");
      return;
    }

    await clearReviewFlag(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
