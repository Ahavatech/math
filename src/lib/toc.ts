import { slugify } from "./slugify";

export type TocEntry = { id: string; level: 2 | 3; text: string };

const HEADING_PATTERN = /<(h2|h3)>([^<]*)<\/\1>/g;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** Extracts a table of contents from every h2/h3 in already-rendered HTML, with unique ids matching addHeadingIds. */
export function extractTableOfContents(html: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();

  for (const match of html.matchAll(HEADING_PATTERN)) {
    const level = Number(match[1].slice(1)) as 2 | 3;
    const text = stripTags(match[2]).trim();
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    entries.push({ id, level, text });
  }

  return entries;
}

/** Injects the same ids extractTableOfContents computes directly into each h2/h3 tag, so the TOC's links actually land somewhere. */
export function addHeadingIds(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(HEADING_PATTERN, (match, tag: string, inner: string) => {
    const text = stripTags(inner).trim();
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
}
