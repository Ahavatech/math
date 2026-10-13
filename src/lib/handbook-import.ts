import { slugify } from "./slugify";
import { markdownToHtml } from "./markdown-to-html";
import { sanitizeRichText } from "./sanitize-html";

export type HandbookImportFile = {
  filename: string;
  title: string;
  slug: string;
  parent: string | null;
  order: number;
  summary: string;
  bodyHtml: string;
};

function parseFrontMatter(raw: string): { attrs: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Missing front matter (expected a --- block at the top of the file)");
  }
  const [, frontMatter, body] = match;
  const attrs: Record<string, string> = {};
  for (const line of frontMatter.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    attrs[key] = value;
  }
  return { attrs, body };
}

/** Pure parsing: no file I/O, no database. The importer script reads the file and passes its raw text in. */
export function parseHandbookImportFile(filename: string, raw: string): HandbookImportFile {
  const { attrs, body } = parseFrontMatter(raw);

  if (!attrs.title) throw new Error(`${filename}: front matter is missing "title"`);
  if (!attrs.slug) throw new Error(`${filename}: front matter is missing "slug"`);

  return {
    filename,
    title: attrs.title,
    slug: slugify(attrs.slug),
    parent: attrs.parent ? slugify(attrs.parent) : null,
    order: attrs.order ? Number(attrs.order) : 0,
    summary: attrs.summary ?? "",
    bodyHtml: sanitizeRichText(markdownToHtml(body)),
  };
}

export type HandbookImportPlanItem =
  | { action: "create"; file: HandbookImportFile }
  | { action: "skip"; file: HandbookImportFile; reason: string };

/**
 * Dry-run planning: no writes. `lookupSlug` reports whether a slug
 * already exists and, if so, whether that existing page itself has a
 * parent (needed to enforce the two-level nesting cap against
 * already-published pages, not just this batch).
 */
export async function planHandbookImport(
  files: HandbookImportFile[],
  deps: { slugExists: (slug: string) => Promise<boolean> },
): Promise<HandbookImportPlanItem[]> {
  const batchBySlug = new Map(files.map((f) => [f.slug, f]));
  const plan: HandbookImportPlanItem[] = [];

  for (const file of files) {
    if (await deps.slugExists(file.slug)) {
      plan.push({ action: "skip", file, reason: `"${file.slug}" already exists - never overwriting an admin's edit` });
      continue;
    }

    if (file.parent) {
      const parentInBatch = batchBySlug.get(file.parent);
      if (parentInBatch?.parent) {
        plan.push({ action: "skip", file, reason: "The handbook tree supports a maximum of two levels" });
        continue;
      }
      if (!parentInBatch && !(await deps.slugExists(file.parent))) {
        plan.push({ action: "skip", file, reason: `Parent "${file.parent}" was not found` });
        continue;
      }
    }

    plan.push({ action: "create", file });
  }

  return plan;
}
