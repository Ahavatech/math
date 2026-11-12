/**
 * Applies the current privacy notice text (src/lib/privacy-notice.ts) to the
 * /privacy page of an existing database, and keeps the page flagged as
 * needing legal review.
 *
 *   npx tsx scripts/set-privacy-notice.ts           update if the page is still the old draft
 *   npx tsx scripts/set-privacy-notice.ts --force   replace whatever is there
 *
 * Without --force it leaves the page alone if someone has already edited it
 * in /admin/pages, so it never overwrites the department's own changes.
 * Safe to run against any database; it touches only this one page.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { OLD_PRIVACY_DRAFT_START, PRIVACY_NOTICE_BODY, PRIVACY_NOTICE_TITLE } from "../src/lib/privacy-notice";

async function main() {
  const force = process.argv.includes("--force");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const page = await db.page.findUnique({ where: { slug: "privacy" } });

    if (!page) {
      await db.page.create({
        data: { slug: "privacy", title: PRIVACY_NOTICE_TITLE, body: PRIVACY_NOTICE_BODY, status: "PUBLISHED" },
      });
      console.log("Created the privacy page.");
    } else if (page.body === PRIVACY_NOTICE_BODY) {
      console.log("The privacy page already has the current text. Nothing to do.");
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

    // Keep it flagged for legal review.
    const flags = await db.siteSetting.findUnique({ where: { key: "pages.legalReviewFlags" } });
    const value = { ...((flags?.value as Record<string, boolean>) ?? {}), privacy: true };
    await db.siteSetting.upsert({
      where: { key: "pages.legalReviewFlags" },
      create: { key: "pages.legalReviewFlags", value },
      update: { value },
    });
    console.log("The page is flagged for legal review in /admin/pages.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
