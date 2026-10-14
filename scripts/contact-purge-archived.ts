import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const RETENTION_MONTHS = 12;

/**
 * Permanently deletes ARCHIVED contact messages whose updatedAt (the
 * moment they were archived) is older than 12 months - the retention
 * period the privacy notice commits to. Dry run by default; pass
 * --apply to actually delete. Stage 14 is expected to schedule this.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const toPurge = await db.contactMessage.findMany({
    where: { status: "ARCHIVED", updatedAt: { lt: cutoff } },
  });

  console.log(`Found ${toPurge.length} archived message(s) older than ${RETENTION_MONTHS} months.`);
  for (const message of toPurge) {
    console.log(`  ${message.id} (archived ${message.updatedAt.toISOString()})`);
  }

  if (apply) {
    await db.contactMessage.deleteMany({ where: { id: { in: toPurge.map((m) => m.id) } } });
    console.log(`Purged ${toPurge.length} message(s).`);
  } else if (toPurge.length > 0) {
    console.log("Dry run only. Re-run with --apply to delete.");
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
