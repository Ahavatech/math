import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinary } from "cloudinary";

// See scripts/alumni-cleanup-orphans.ts for why this duplicates
// src/lib/cloudinary.ts's config instead of importing it (server-only).
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const RETENTION_DAYS = 90;

/**
 * Permanently deletes REJECTED alumni entries (and their photos, if
 * any) whose updatedAt is older than 90 days - the retention period
 * docs/ALUMNI.md and the privacy notice commit to. Dry run by default;
 * pass --apply to actually delete. Stage 14 is expected to schedule this.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const toPurge = await db.alumniEntry.findMany({
    where: { status: "REJECTED", updatedAt: { lt: cutoff } },
    include: { photo: true },
  });

  console.log(`Found ${toPurge.length} rejected alumni entry/entries older than ${RETENTION_DAYS} days.`);
  for (const entry of toPurge) {
    console.log(`  ${entry.id} (rejected ${entry.updatedAt.toISOString()})`);
  }

  if (apply) {
    for (const entry of toPurge) {
      if (entry.photo) {
        await cloudinary.api.delete_resources([entry.photo.publicId], {
          resource_type: "image",
          type: entry.photo.deliveryType,
        });
      }
      await db.alumniEntry.delete({ where: { id: entry.id } });
    }
    console.log(`Purged ${toPurge.length} entry/entries.`);
  } else if (toPurge.length > 0) {
    console.log("Dry run only. Re-run with --apply to delete.");
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
