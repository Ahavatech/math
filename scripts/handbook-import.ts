import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseHandbookImportFile, planHandbookImport, type HandbookImportFile } from "../src/lib/handbook-import";
import { normalizeSearchText } from "../src/lib/search-text";

const DEFAULT_FOLDER = "docs/handbook-import";

/**
 * Reads Markdown files with front matter from a folder (default
 * docs/handbook-import/) and creates DRAFT HandbookPage rows. Dry run
 * by default; pass --apply to actually write. Never overwrites a page
 * an admin has already edited - a slug that already exists is skipped
 * and reported, not touched. Parent references are resolved in two
 * passes so files can be listed in any order (parents don't need to
 * come before their children in the folder).
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const folderArg = process.argv.find((a) => a.startsWith("--folder="));
  const folder = folderArg ? folderArg.slice("--folder=".length) : DEFAULT_FOLDER;

  const filenames = readdirSync(folder).filter((f) => f.endsWith(".md") && f !== "README.md");
  if (filenames.length === 0) {
    console.log(`No .md files found in ${folder}`);
    return;
  }

  const files: HandbookImportFile[] = [];
  for (const filename of filenames) {
    try {
      const raw = readFileSync(join(folder, filename), "utf8");
      files.push(parseHandbookImportFile(filename, raw));
    } catch (error) {
      console.error(`Skipping ${filename}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const plan = await planHandbookImport(files, {
    slugExists: async (slug) => (await db.handbookPage.findUnique({ where: { slug } })) !== null,
  });

  console.log(`Plan for ${plan.length} file(s):`);
  for (const item of plan) {
    if (item.action === "create") {
      console.log(`  CREATE  ${item.file.filename} -> /${item.file.slug}`);
    } else {
      console.log(`  SKIP    ${item.file.filename} -> ${item.reason}`);
    }
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write these pages.");
    await db.$disconnect();
    return;
  }

  // Two passes: top-level pages first (so a child's parentId can be
  // resolved), then children, in case the folder lists them out of order.
  const toCreate = plan.filter((p) => p.action === "create").map((p) => p.file);
  const slugToId = new Map<string, string>();

  for (const file of toCreate.filter((f) => !f.parent)) {
    const created = await db.handbookPage.create({
      data: {
        title: file.title,
        slug: file.slug,
        summary: file.summary,
        body: file.bodyHtml,
        order: file.order,
        status: "DRAFT",
        searchText: normalizeSearchText(`${file.title} ${file.summary} ${file.bodyHtml}`),
      },
    });
    slugToId.set(file.slug, created.id);
  }
  for (const file of toCreate.filter((f) => f.parent)) {
    const parentId = slugToId.get(file.parent!);
    const created = await db.handbookPage.create({
      data: {
        title: file.title,
        slug: file.slug,
        summary: file.summary,
        body: file.bodyHtml,
        order: file.order,
        status: "DRAFT",
        parentId: parentId ?? null,
        searchText: normalizeSearchText(`${file.title} ${file.summary} ${file.bodyHtml}`),
      },
    });
    slugToId.set(file.slug, created.id);
  }

  console.log(`\nCreated ${toCreate.length} page(s) as DRAFT.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
