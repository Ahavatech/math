import { describe, expect, it } from "vitest";
import { normalizeSearchText } from "../search-text";

describe("normalizeSearchText", () => {
  it("strips HTML tags", () => {
    expect(normalizeSearchText("<p>Hello <strong>world</strong></p>")).toBe("hello world");
  });

  it("folds Yoruba diacritics", () => {
    expect(normalizeSearchText("Ọlá Adéṣọlá")).toBe(normalizeSearchText("Ola Adesola"));
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeSearchText("  MTH   101   Calculus  ")).toBe("mth 101 calculus");
  });

  it("strips a script tag payload entirely, including its content", () => {
    const result = normalizeSearchText("<script>alert(1)</script>Safe text");
    expect(result).not.toContain("<script");
    expect(result).toContain("safe text");
  });

  it("is idempotent: normalizing an already-normalized string does not change it", () => {
    const once = normalizeSearchText("Course title with Ìjẹ̀bú names");
    expect(normalizeSearchText(once)).toBe(once);
  });
});
