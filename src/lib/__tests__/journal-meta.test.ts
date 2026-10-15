import { describe, expect, it } from "vitest";
import {
  buildCitationMetaTags,
  buildDublinCoreMetaTags,
  buildScholarlyArticleJsonLd,
  type ArticleMetaInput,
} from "../journal-meta";
import { safeJsonLdString } from "../json-ld";

const base: ArticleMetaInput = {
  title: "On the Classification of Finite Groups",
  authors: ["Jane Doe", "John Smith"],
  publishedAt: new Date("2026-03-15T00:00:00.000Z"),
  journalName: "Journal of Departmental Mathematics",
  issn: "1050-124X",
  volume: 3,
  issue: 1,
  pageStart: 10,
  pageEnd: 20,
  doi: "10.1234/jdm.2026.0001",
  pdfUrl: "https://example.com/journal/articles/slug/pdf",
  abstractUrl: "https://example.com/journal/articles/slug",
  keywords: ["algebra", "group theory"],
  abstract: "A simple abstract.",
  language: "en",
};

describe("buildCitationMetaTags", () => {
  it("includes one citation_author tag per author, in order", () => {
    const tags = buildCitationMetaTags(base);
    const authorTags = tags.filter((t) => t.name === "citation_author").map((t) => t.content);
    expect(authorTags).toEqual(["Jane Doe", "John Smith"]);
  });

  it("includes citation_title, citation_journal_title, citation_doi, citation_pdf_url, citation_abstract_html_url", () => {
    const tags = buildCitationMetaTags(base);
    const byName = Object.fromEntries(tags.map((t) => [t.name, t.content]));
    expect(byName.citation_title).toBe(base.title);
    expect(byName.citation_journal_title).toBe(base.journalName);
    expect(byName.citation_doi).toBe(base.doi);
    expect(byName.citation_pdf_url).toBe(base.pdfUrl);
    expect(byName.citation_abstract_html_url).toBe(base.abstractUrl);
    expect(byName.citation_issn).toBe(base.issn);
    expect(byName.citation_volume).toBe("3");
    expect(byName.citation_issue).toBe("1");
    expect(byName.citation_firstpage).toBe("10");
    expect(byName.citation_lastpage).toBe("20");
    expect(byName.citation_language).toBe("en");
  });

  it("formats citation_publication_date as YYYY/M/D, unpadded, per Scholar's own example (2010/5/12)", () => {
    const tags = buildCitationMetaTags(base);
    const date = tags.find((t) => t.name === "citation_publication_date");
    expect(date?.content).toBe("2026/3/15");
  });

  it("joins keywords with a semicolon", () => {
    const tags = buildCitationMetaTags(base);
    const kw = tags.find((t) => t.name === "citation_keywords");
    expect(kw?.content).toBe("algebra; group theory");
  });

  it("omits optional tags when the data is missing (no doi, no issn, no pages)", () => {
    const tags = buildCitationMetaTags({ ...base, doi: null, issn: null, pageStart: null, pageEnd: null });
    const names = tags.map((t) => t.name);
    expect(names).not.toContain("citation_doi");
    expect(names).not.toContain("citation_issn");
    expect(names).not.toContain("citation_firstpage");
    expect(names).not.toContain("citation_lastpage");
  });

  it("preserves LaTeX in the title and a Yoruba-diacritic author name verbatim", () => {
    const tags = buildCitationMetaTags({
      ...base,
      title: "A note on $x^2+y^2=z^2$",
      authors: ["Adéṣọlá Ọlábísí"],
    });
    const byName = Object.fromEntries(tags.map((t) => [t.name, t.content]));
    expect(byName.citation_title).toBe("A note on $x^2+y^2=z^2$");
    expect(tags.filter((t) => t.name === "citation_author").map((t) => t.content)).toEqual([
      "Adéṣọlá Ọlábísí",
    ]);
  });
});

describe("buildDublinCoreMetaTags", () => {
  it("includes DC.title, DC.creator (one per author), DC.date, DC.identifier", () => {
    const tags = buildDublinCoreMetaTags(base);
    expect(tags.find((t) => t.name === "DC.title")?.content).toBe(base.title);
    const creators = tags.filter((t) => t.name === "DC.creator").map((t) => t.content);
    expect(creators).toEqual(["Jane Doe", "John Smith"]);
    expect(tags.find((t) => t.name === "DC.date")?.content).toBe("2026-03-15");
    expect(tags.find((t) => t.name === "DC.identifier")?.content).toBe(base.doi);
  });

  it("falls back to the abstract URL as DC.identifier when there is no DOI", () => {
    const tags = buildDublinCoreMetaTags({ ...base, doi: null });
    expect(tags.find((t) => t.name === "DC.identifier")?.content).toBe(base.abstractUrl);
  });
});

describe("buildScholarlyArticleJsonLd", () => {
  it("produces a schema.org ScholarlyArticle with quotes in the abstract surviving a JSON round-trip", () => {
    const jsonLd = buildScholarlyArticleJsonLd({ ...base, abstract: 'He said "hello" to the group.' });
    const serialized = safeJsonLdString(jsonLd);
    const parsed = JSON.parse(serialized);
    expect(parsed["@type"]).toBe("ScholarlyArticle");
    expect(parsed.headline).toBe(base.title);
    expect(parsed.description).toBe('He said "hello" to the group.');
    expect(parsed.author).toEqual([
      { "@type": "Person", name: "Jane Doe" },
      { "@type": "Person", name: "John Smith" },
    ]);
    expect(parsed.datePublished).toBe("2026-03-15");
    expect(parsed.isPartOf["@type"]).toBe("Periodical");
    expect(parsed.isPartOf.name).toBe(base.journalName);
  });

  it("escapes a </script> payload embedded in the title so it cannot break out of the script tag", () => {
    const jsonLd = buildScholarlyArticleJsonLd({ ...base, title: "</script><script>alert(1)</script>" });
    const serialized = safeJsonLdString(jsonLd);
    expect(serialized).not.toContain("</script>");
  });

  it("includes the DOI as a sameAs URL when present", () => {
    const jsonLd = buildScholarlyArticleJsonLd(base) as { sameAs?: string };
    expect(jsonLd.sameAs).toBe("https://doi.org/10.1234/jdm.2026.0001");
  });
});
