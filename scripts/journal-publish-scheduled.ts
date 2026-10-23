/**
 * Publishes articles whose scheduledFor date has passed.
 *
 * Usage:
 *   npx tsx scripts/journal-publish-scheduled.ts          # dry run (default)
 *   npx tsx scripts/journal-publish-scheduled.ts --apply  # publish eligible articles
 *
 * Add to cron (Section 14 scheduled-jobs): run every 15 minutes.
 * The script is idempotent: re-running after --apply publishes nothing new.
 */
import "../src/lib/env";
import { PrismaClient } from "@prisma/client";
import type { SessionUser } from "../src/lib/rbac";
import { publishArticle } from "../src/server/services/article-publication";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const now = new Date();
  const due = await db.article.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
    },
    select: { id: true, title: true, slug: true },
  });

  if (due.length === 0) {
    console.log("No scheduled articles are due for publication.");
    await db.$disconnect();
    return;
  }

  // Use a system actor with SUPER_ADMIN for the scheduled job
  const systemActor: SessionUser = {
    id: "system-scheduled-job",
    roles: ["SUPER_ADMIN"],
    isActive: true,
  };

  console.log(`Found ${due.length} article(s) due for publication${apply ? "" : " (dry run)"}.`);

  for (const article of due) {
    console.log(`  - "${article.title}" (${article.slug})`);
    if (apply) {
      const result = await publishArticle(db, systemActor, article.id);
      if (result.ok) {
        console.log(`    Published: ${article.slug}`);
      } else {
        console.error(`    ERROR: ${result.reason}`);
      }
    }
  }

  if (!apply) {
    console.log("\nRe-run with --apply to publish these articles.");
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
