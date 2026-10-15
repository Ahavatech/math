import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { v2 as cloudinary } from "cloudinary";

// Duplicates src/lib/cloudinary.ts's config rather than importing it:
// that module starts with `import "server-only"`, which throws
// unconditionally outside a Next.js build (this script runs under
// plain tsx), not just when actually imported into client code - same
// reasoning as scripts/admin-invite.ts.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const ALUMNI_PENDING_FOLDER = "oau-maths/alumni/pending";

/**
 * Deletes Cloudinary resources under oau-maths/alumni/pending that are
 * older than 24 hours and that no MediaAsset row references - e.g. an
 * upload whose form submission never completed. Dry run by default;
 * pass --apply to actually delete. Stage 14 is expected to schedule
 * this (e.g. a daily cron job) once the app is deployed.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const resources: { public_id: string; created_at: string }[] = [];
  let nextCursor: string | undefined;

  do {
    const page = await cloudinary.api.resources({
      type: "authenticated",
      resource_type: "image",
      prefix: `${ALUMNI_PENDING_FOLDER}/`,
      max_results: 500,
      next_cursor: nextCursor,
    });
    resources.push(...page.resources);
    nextCursor = page.next_cursor;
  } while (nextCursor);

  const referenced = new Set(
    (
      await db.mediaAsset.findMany({
        where: { publicId: { startsWith: `${ALUMNI_PENDING_FOLDER}/` } },
        select: { publicId: true },
      })
    ).map((a) => a.publicId),
  );

  const orphans = resources.filter(
    (r) => !referenced.has(r.public_id) && new Date(r.created_at).getTime() < cutoff,
  );

  console.log(`Found ${orphans.length} orphaned pending alumni photo(s) older than 24 hours.`);
  for (const orphan of orphans) {
    console.log(`  ${orphan.public_id} (created ${orphan.created_at})`);
  }

  if (apply && orphans.length > 0) {
    await cloudinary.api.delete_resources(orphans.map((o) => o.public_id), {
      resource_type: "image",
      type: "authenticated",
    });
    console.log(`Deleted ${orphans.length} orphaned photo(s).`);
  } else if (orphans.length > 0) {
    console.log("Dry run only. Re-run with --apply to delete.");
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
