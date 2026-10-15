/**
 * Case- and accent-insensitive fold for free-text name search, so a
 * plain-ASCII query like "Adeshola" matches a stored name with Yoruba
 * diacritics like "Adéṣọlá". NFD decomposes each accented letter into a
 * base letter plus combining marks (acute/grave/underdot etc.), which are
 * then stripped - the same technique src/lib/slugify.ts uses for slugs.
 */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesSearch(haystack: string, query: string): boolean {
  const foldedQuery = foldForSearch(query);
  if (!foldedQuery) return true;
  return foldForSearch(haystack).includes(foldedQuery);
}
