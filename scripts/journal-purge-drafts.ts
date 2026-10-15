import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { privateStorage } from "../src/lib/private-storage";

/**
 * Purges INCOMPLETE manuscript drafts not updated in 60+ days.
 * Dry run by default; pass --apply to delete.
 * Never touches SUBMITTED or later manuscripts.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const drafts = await db.manuscript.findMany({
    where: { status: "INCOMPLETE", updatedAt: { lt: cutoff } },
    select: { id: true, updatedAt: true, files: { select: { id: true, storageKey: true } } },
  });

  console.log(`${drafts.length} INCOMPLETE draft(s) last updated before ${cutoff.toISOString()}:`);
  for (const d of drafts) {
    console.log(`  ${d.id}  (updated ${d.updatedAt.toISOString()}, ${d.files.length} file(s))`);
  }

  if (!apply) {
    if (drafts.length > 0) console.log("Dry run only. Re-run with --apply to delete.");
    await db.$disconnect();
    return;
  }

  const storage = privateStorage();
  let deleted = 0;

  for (const draft of drafts) {
    for (const file of draft.files) {
      try { await storage.remove(file.storageKey); } catch { /* already missing */ }
    }
    await db.manuscript.delete({ where: { id: draft.id } });
    deleted++;
  }

  console.log(`Deleted ${deleted} draft(s).`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
