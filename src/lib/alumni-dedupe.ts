const TITLE_WORDS = new Set(["dr", "prof", "mr", "mrs", "miss", "ms", "engr", "chief", "alhaji", "alhaja"]);

/**
 * Flagging-only duplicate key: NFKD-normalise (folds diacritics), strip
 * combining marks, drop a leading/trailing title word, lowercase and
 * collapse whitespace, then append the graduation year. This matches
 * an accent-stripped equivalent spelling ("Ọlá Adéṣọlá" ~ "Ola
 * Adesola") but never an anglicized respelling that changes letters
 * ("Adeshola" for "Adéṣọlá") - same scope limit as the staff directory
 * search in src/lib/text-search.ts (DECISIONS.md #38). Never used for
 * an automatic merge, only to show a "possible duplicate" flag to a
 * human reviewer.
 */
export function computeDedupeKey(fullName: string, graduationYear: number): string {
  const folded = fullName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");

  const words = folded.split(" ").filter((word) => !TITLE_WORDS.has(word));

  return `${words.join(" ")}|${graduationYear}`;
}
