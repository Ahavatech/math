import { describe, expect, it } from "vitest";
import { formatApaCitation, formatBibTex, formatRis, type CitationInput } from "../citation";

const base: CitationInput = {
  title: "On the Classification of Finite Groups",
  authors: ["Jane Doe", "John Smith"],
  year: 2026,
  journalName: "Journal of Departmental Mathematics",
  volume: 3,
  issue: 1,
  pageStart: 10,
  pageEnd: 20,
  doi: "10.1234/jdm.2026.0001",
  slug: "on-the-classification-of-finite-groups",
};

describe("formatApaCitation", () => {
  it("formats a standard APA-style string", () => {
    const result = formatApaCitation(base);
    expect(result).toBe(
      "Doe, J., & Smith, J. (2026). On the classification of finite groups. Journal of Departmental Mathematics, 3(1), 10-20. https://doi.org/10.1234/jdm.2026.0001",
    );
  });

  it("formats a single author correctly (no ampersand)", () => {
    const result = formatApaCitation({ ...base, authors: ["Jane Doe"] });
    expect(result).toContain("Doe, J. (2026).");
    expect(result).not.toContain("&");
  });

  it("formats three or more authors with commas and a final ampersand", () => {
    const result = formatApaCitation({ ...base, authors: ["Jane Doe", "John Smith", "Amaka Eze"] });
    expect(result).toContain("Doe, J., Smith, J., & Eze, A. (2026).");
  });

  it("omits the DOI segment when there is none", () => {
    const result = formatApaCitation({ ...base, doi: "" });
    expect(result).not.toContain("doi.org");
    expect(result.endsWith("10-20.")).toBe(true);
  });

  it("handles a Yoruba-diacritic author name without corruption", () => {
    const result = formatApaCitation({ ...base, authors: ["Adéṣọlá Ọlábísí"] });
    expect(result).toContain("Ọlábísí, A.");
  });

  it("handles a title containing LaTeX math, left exactly as stored", () => {
    const result = formatApaCitation({ ...base, title: "A note on $x^2 + y^2 = z^2$" });
    expect(result).toContain("A note on $x^2 + y^2 = z^2$.");
  });

  it("omits volume/issue/pages when missing", () => {
    const result = formatApaCitation({ ...base, volume: null, issue: null, pageStart: null, pageEnd: null, doi: "" });
    expect(result).toBe("Doe, J., & Smith, J. (2026). On the classification of finite groups. Journal of Departmental Mathematics.");
  });
});

describe("formatBibTex", () => {
  it("produces a well-formed @article entry", () => {
    const result = formatBibTex(base);
    expect(result).toContain("@article{on-the-classification-of-finite-groups,");
    expect(result).toContain("title = {On the Classification of Finite Groups},");
    expect(result).toContain("author = {Doe, Jane and Smith, John},");
    expect(result).toContain("year = {2026},");
    expect(result).toContain("journal = {Journal of Departmental Mathematics},");
    expect(result).toContain("volume = {3},");
    expect(result).toContain("number = {1},");
    expect(result).toContain("pages = {10--20},");
    expect(result).toContain("doi = {10.1234/jdm.2026.0001}");
    expect(result.trim().endsWith("}")).toBe(true);
  });

  it("escapes BibTeX special characters in the title (braces, ampersand, percent, underscore)", () => {
    const result = formatBibTex({ ...base, title: "100% proof & a_weird{title}" });
    expect(result).toContain("title = {100\\% proof \\& a\\_weird\\{title\\}},");
  });

  it("preserves LaTeX math delimiters in the title safely (does not escape $ or ^)", () => {
    const result = formatBibTex({ ...base, title: "A note on $x^2 + y^2$" });
    expect(result).toContain("title = {A note on $x^2 + y^2$},");
  });

  it("handles a Yoruba-diacritic author name", () => {
    const result = formatBibTex({ ...base, authors: ["Adéṣọlá Ọlábísí"] });
    expect(result).toContain("author = {Ọlábísí, Adéṣọlá},");
  });

  it("rejects CRLF injection in a field by stripping control characters", () => {
    const result = formatBibTex({ ...base, title: "Evil\r\n@article{injected,title={haha}" });
    expect(result.split("\n").filter((l) => l.startsWith("@article{")).length).toBe(1);
  });
});

describe("formatRis", () => {
  it("produces well-formed RIS lines with CRLF line endings", () => {
    const result = formatRis(base);
    const lines = result.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("TY  - JOUR");
    expect(lines).toContain("TI  - On the Classification of Finite Groups");
    expect(lines).toContain("AU  - Doe, Jane");
    expect(lines).toContain("AU  - Smith, John");
    expect(lines).toContain("PY  - 2026");
    expect(lines).toContain("JO  - Journal of Departmental Mathematics");
    expect(lines).toContain("VL  - 3");
    expect(lines).toContain("IS  - 1");
    expect(lines).toContain("SP  - 10");
    expect(lines).toContain("EP  - 20");
    expect(lines).toContain("DO  - 10.1234/jdm.2026.0001");
    expect(lines[lines.length - 1]).toBe("ER  - ");
  });

  it("protects against CRLF injection in a field value", () => {
    const result = formatRis({ ...base, title: "Evil\r\nAU  - Injected, Author" });
    const lines = result.split("\r\n").filter(Boolean);
    expect(lines.filter((l) => l.startsWith("AU  - Injected")).length).toBe(0);
    expect(lines.some((l) => l.startsWith("TI  - Evil"))).toBe(true);
  });

  it("handles a Yoruba-diacritic author name", () => {
    const result = formatRis({ ...base, authors: ["Adéṣọlá Ọlábísí"] });
    expect(result).toContain("AU  - Ọlábísí, Adéṣọlá");
  });
});
