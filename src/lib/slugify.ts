export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Appends -2, -3, ... to the base slug until `exists` reports a free one.
 * `exists` is injected so this needs no database to test.
 */
export async function generateUniqueSlug(
  title: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
