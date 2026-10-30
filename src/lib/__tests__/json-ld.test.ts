import { describe, expect, it } from "vitest";
import {
  safeJsonLdString,
  buildPersonJsonLd,
  buildEventJsonLd,
  buildNewsArticleJsonLd,
  buildCourseJsonLd,
  buildScholarlyArticleJsonLd,
} from "../json-ld";

describe("safeJsonLdString", () => {
  it("escapes < so a title cannot break out of the surrounding <script> tag", () => {
    const malicious = { name: '</script><script>alert(1)</script>' };
    const result = safeJsonLdString(malicious);
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c");
  });

  it("still parses back to the original value", () => {
    const data = { name: "A, B; C <D>", year: 2026 };
    expect(JSON.parse(safeJsonLdString(data))).toEqual(data);
  });
});

describe("buildPersonJsonLd", () => {
  it("emits Person type with correct url and worksFor", () => {
    const ld = buildPersonJsonLd({
      name: "Prof. A. Adeyemi",
      slug: "a-adeyemi",
      honorific: "Prof.",
      rank: "PROFESSOR",
      orcid: "0000-0001-2345-6789",
      siteUrl: "https://maths.oauife.edu.ng",
    });
    expect(ld["@type"]).toBe("Person");
    expect(ld.url).toBe("https://maths.oauife.edu.ng/lecturer/a-adeyemi");
    expect(ld.sameAs).toContain("https://orcid.org/0000-0001-2345-6789");
    expect((ld.worksFor as { name: string }).name).toContain("Mathematics");
  });
});

describe("buildEventJsonLd", () => {
  it("emits Event type with correct startDate and url", () => {
    const start = new Date("2026-11-15T10:00:00Z");
    const ld = buildEventJsonLd({
      title: "Algebra Seminar",
      slug: "algebra-seminar-2026",
      startsAt: start,
      venue: "Room 201",
      siteUrl: "https://maths.oauife.edu.ng",
    });
    expect(ld["@type"]).toBe("Event");
    expect(ld.startDate).toBe(start.toISOString());
    expect(ld.url).toBe("https://maths.oauife.edu.ng/events/algebra-seminar-2026");
  });

  it("does not emit EventJsonLd for undefined performer when no speaker", () => {
    const ld = buildEventJsonLd({
      title: "Open Day",
      slug: "open-day",
      startsAt: new Date(),
      siteUrl: "https://maths.oauife.edu.ng",
    });
    expect(ld.performer).toBeUndefined();
  });
});

describe("buildNewsArticleJsonLd", () => {
  it("emits NewsArticle type with headline and url", () => {
    const ld = buildNewsArticleJsonLd({
      title: "New Research Grant",
      slug: "new-research-grant",
      publishedAt: new Date("2026-10-01T00:00:00Z"),
      siteUrl: "https://maths.oauife.edu.ng",
    });
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld.headline).toBe("New Research Grant");
    expect(ld.url).toBe("https://maths.oauife.edu.ng/news/new-research-grant");
  });
});

describe("buildCourseJsonLd", () => {
  it("emits Course type with courseCode and provider", () => {
    const ld = buildCourseJsonLd({
      title: "Real Analysis I",
      code: "MAT301",
      slug: "mat301",
      siteUrl: "https://maths.oauife.edu.ng",
    });
    expect(ld["@type"]).toBe("Course");
    expect(ld.courseCode).toBe("MAT301");
    expect(ld.url).toBe("https://maths.oauife.edu.ng/students/courses/mat301");
    expect((ld.provider as { name: string }).name).toContain("Mathematics");
  });
});

describe("buildScholarlyArticleJsonLd", () => {
  it("emits ScholarlyArticle type with doi sameAs and author list", () => {
    const ld = buildScholarlyArticleJsonLd({
      title: "On Spectral Theory",
      slug: "on-spectral-theory",
      doi: "10.1234/jmath.2026.001",
      authors: [
        { name: "A. Adeyemi", orcid: "0000-0001-0000-0001" },
        { name: "B. Babatunde" },
      ],
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      siteUrl: "https://maths.oauife.edu.ng",
    });
    expect(ld["@type"]).toBe("ScholarlyArticle");
    expect(ld.sameAs).toContain("https://doi.org/10.1234/jmath.2026.001");
    expect(Array.isArray(ld.author)).toBe(true);
    expect((ld.author as Array<{ name: string }>)[0].name).toBe("A. Adeyemi");
    expect(ld.url).toBe("https://maths.oauife.edu.ng/journal/articles/on-spectral-theory");
  });

  it("emits nothing for draft/unpublished when caller passes no publishedAt", () => {
    const ld = buildScholarlyArticleJsonLd({
      title: "Draft Paper",
      slug: "draft-paper",
      siteUrl: "https://maths.oauife.edu.ng",
    });
    expect(ld.datePublished).toBeUndefined();
  });
});
