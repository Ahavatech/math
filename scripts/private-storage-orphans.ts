import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "../src/lib/env";

/**
 * Lists (dry run by default; --apply to delete) files on disk under
 * PRIVATE_STORAGE_DIR that no ManuscriptFile row references, and rows
 * whose storageKey points at a file that no longer exists.
 * Covers all ManuscriptFileKind values including REVIEW_ATTACHMENT (spec section 8).
 * Stage 14 is expected to schedule this and include the directory in backups.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const root = env.PRIVATE_STORAGE_DIR ?? path.join(process.cwd(), ".private-storage");

  const rows = await db.manuscriptFile.findMany({ select: { id: true, storageKey: true } });
  const referencedKeys = new Set(rows.map((r) => r.storageKey));

  const diskKeys: string[] = [];
  try {
    const level1 = await readdir(root, { withFileTypes: true });
    for (const d1 of level1) {
      if (!d1.isDirectory()) continue;
      const level2 = await readdir(path.join(root, d1.name), { withFileTypes: true });
      for (const d2 of level2) {
        if (!d2.isDirectory()) continue;
        const files = await readdir(path.join(root, d1.name, d2.name));
        for (const file of files) {
          if (file.endsWith(".tmp")) continue;
          diskKeys.push(`${d1.name}/${d2.name}/${file}`);
        }
      }
    }
  } catch {
    console.log(`No private storage directory at ${root} yet.`);
  }

  const orphanFiles = diskKeys.filter((k) => !referencedKeys.has(k));
  const missingFiles = rows.filter((r) => !diskKeys.includes(r.storageKey));

  console.log(`${orphanFiles.length} file(s) on disk with no ManuscriptFile row:`);
  for (const key of orphanFiles) console.log(`  ${key}`);

  console.log(`${missingFiles.length} ManuscriptFile row(s) whose file is missing from disk:`);
  for (const row of missingFiles) console.log(`  ${row.id} (${row.storageKey})`);

  if (apply) {
    for (const key of orphanFiles) {
      await unlink(path.join(root, key));
    }
    console.log(`Deleted ${orphanFiles.length} orphan file(s).`);
  } else if (orphanFiles.length > 0 || missingFiles.length > 0) {
    console.log("Dry run only. Re-run with --apply to delete orphan files.");
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
