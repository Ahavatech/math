/**
 * Shared normalisation for the `searchText` column computed on every
 * save of handbook pages and courses (Stage 10): strip HTML, fold
 * diacritics (NFKD, which covers Yoruba underdots/tone marks the same
 * way src/lib/text-search.ts's NFD fold does, plus compatibility
 * decompositions NFD alone misses), lowercase, collapse whitespace.
 * The exact same function normalises an incoming search query, so a
 * substring match against the stored column is meaningful.
 */
export function normalizeSearchText(input: string): string {
  const withoutScripts = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return withoutTags
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
