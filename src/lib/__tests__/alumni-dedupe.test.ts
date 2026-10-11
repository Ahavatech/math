import { describe, expect, it } from "vitest";
import { computeDedupeKey } from "../alumni-dedupe";

describe("computeDedupeKey", () => {
  it("folds diacritics so an accented name matches its accent-stripped equivalent", () => {
    expect(computeDedupeKey("Ọlá Adéṣọlá", 2010)).toBe(computeDedupeKey("Ola Adesola", 2010));
  });

  it("does not match an anglicized respelling that changes letters", () => {
    expect(computeDedupeKey("Ọlá Adéṣọlá", 2010)).not.toBe(computeDedupeKey("Ola Adeshola", 2010));
  });

  it("strips common titles", () => {
    expect(computeDedupeKey("Dr Ola Adesola", 2010)).toBe(computeDedupeKey("Ola Adesola", 2010));
    expect(computeDedupeKey("Prof. Ola Adesola", 2010)).toBe(computeDedupeKey("Ola Adesola", 2010));
    expect(computeDedupeKey("Engr Ola Adesola", 2010)).toBe(computeDedupeKey("Ola Adesola", 2010));
    expect(computeDedupeKey("Mrs Ola Adesola", 2010)).toBe(computeDedupeKey("Ola Adesola", 2010));
  });

  it("folds case and collapses whitespace", () => {
    expect(computeDedupeKey("  OLA   ADESOLA  ", 2010)).toBe(computeDedupeKey("Ola Adesola", 2010));
  });

  it("includes the graduation year, so the same name in a different year does not match", () => {
    expect(computeDedupeKey("Ola Adesola", 2010)).not.toBe(computeDedupeKey("Ola Adesola", 2011));
  });
});
