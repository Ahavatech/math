import { describe, expect, it } from "vitest";
import { foldForSearch, matchesSearch } from "../text-search";

describe("foldForSearch", () => {
  it("lowercases and strips accents", () => {
    expect(foldForSearch("José García")).toBe("jose garcia");
  });

  it("folds Yoruba diacritics and underdots", () => {
    expect(foldForSearch("Adéṣọlá")).toBe("adesola");
    expect(foldForSearch("Ọlábísí")).toBe("olabisi");
  });
});

describe("matchesSearch", () => {
  it("matches a plain-ASCII query against a diacritic name", () => {
    expect(matchesSearch("Adéṣọlá Ọlábísí", "adesola")).toBe(true);
    expect(matchesSearch("Adéṣọlá Ọlábísí", "Olabisi")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(matchesSearch("Test Lecturer A", "LECTURER")).toBe(true);
  });

  it("returns false for a non-matching query", () => {
    expect(matchesSearch("Adéṣọlá", "zzz")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesSearch("Anything", "")).toBe(true);
    expect(matchesSearch("Anything", "   ")).toBe(true);
  });
});
