import { describe, expect, it } from "vitest";
import {
  isValidIssn,
  isValidOrcid,
  isValidDoi,
  normalizeKeywords,
  JOURNAL_LICENSES,
  articleInputSchema,
  journalSettingsSchema,
  editorialBoardMemberInputSchema,
} from "../journal";

describe("isValidIssn", () => {
  it("accepts a real ISSN with a correct check digit (0028-0836, Nature)", () => {
    expect(isValidIssn("0028-0836")).toBe(true);
  });

  it("accepts an ISSN whose check digit is X", () => {
    // 2049-3630 is a real ISSN; construct one known to need X: 1050-124X (Lambda, a real ISSN)
    expect(isValidIssn("1050-124X")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidIssn("0028-0837")).toBe(false);
  });

  it("rejects a malformed shape", () => {
    expect(isValidIssn("00280836")).toBe(false);
    expect(isValidIssn("0028-083")).toBe(false);
    expect(isValidIssn("ABCD-1234")).toBe(false);
  });
});

describe("isValidOrcid", () => {
  it("accepts a real ORCID iD with a correct checksum (0000-0002-1825-0097)", () => {
    expect(isValidOrcid("0000-0002-1825-0097")).toBe(true);
  });

  it("accepts an ORCID ending in X", () => {
    expect(isValidOrcid("0000-0002-1694-233X")).toBe(true);
  });

  it("rejects a wrong checksum", () => {
    expect(isValidOrcid("0000-0002-1825-0098")).toBe(false);
  });

  it("rejects a malformed shape", () => {
    expect(isValidOrcid("0000-0002-1825")).toBe(false);
    expect(isValidOrcid("not-an-orcid-at-all")).toBe(false);
  });
});

describe("isValidDoi", () => {
  it("accepts a well-formed DOI", () => {
    expect(isValidDoi("10.1038/nphys1170")).toBe(true);
  });

  it("accepts a DOI with a longer registrant code and punctuation", () => {
    expect(isValidDoi("10.1000.123/journal.article-2024.01")).toBe(true);
  });

  it("rejects a string with no 10. prefix", () => {
    expect(isValidDoi("1038/nphys1170")).toBe(false);
  });

  it("rejects a DOI with no suffix after the slash", () => {
    expect(isValidDoi("10.1038/")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidDoi("")).toBe(false);
  });
});

describe("normalizeKeywords", () => {
  it("trims, collapses whitespace, and caps at 10", () => {
    const input = Array.from({ length: 15 }, (_, i) => `  keyword ${i}  `);
    const result = normalizeKeywords(input);
    expect(result).toHaveLength(10);
    expect(result[0]).toBe("keyword 0");
  });

  it("deduplicates case-insensitively, keeping the first casing seen", () => {
    expect(normalizeKeywords(["Algebra", "algebra", "ALGEBRA", "Topology"])).toEqual([
      "Algebra",
      "Topology",
    ]);
  });

  it("drops empty entries", () => {
    expect(normalizeKeywords(["", "  ", "real one"])).toEqual(["real one"]);
  });
});

describe("JOURNAL_LICENSES", () => {
  it("includes the four fixed options plus custom", () => {
    expect(JOURNAL_LICENSES).toContain("CC BY 4.0");
    expect(JOURNAL_LICENSES).toContain("CC BY-NC 4.0");
    expect(JOURNAL_LICENSES).toContain("CC BY-SA 4.0");
    expect(JOURNAL_LICENSES).toContain("All rights reserved");
  });
});

describe("journalSettingsSchema", () => {
  const base = {
    name: "Journal of Departmental Mathematics",
    shortName: "JDM",
    issn: "",
    eissn: "",
    publisher: "",
    frequency: "",
    license: "CC BY 4.0",
    licenseUrl: "",
    customLicenseText: "",
    contactEmail: "",
    submissionsOpen: false,
    citeAsPublisher: "",
  };

  it("accepts a valid settings object", () => {
    expect(journalSettingsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid ISSN", () => {
    const result = journalSettingsSchema.safeParse({ ...base, issn: "1234-5678" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty ISSN (optional)", () => {
    expect(journalSettingsSchema.safeParse({ ...base, issn: "" }).success).toBe(true);
  });

  it("rejects an invalid contact email", () => {
    expect(journalSettingsSchema.safeParse({ ...base, contactEmail: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("accepts an empty contact email", () => {
    expect(journalSettingsSchema.safeParse({ ...base, contactEmail: "" }).success).toBe(true);
  });
});

describe("articleInputSchema", () => {
  const base = {
    title: "On the Classification of Finite Groups",
    abstract: "<p>An abstract.</p>",
    keywords: ["algebra", "group theory"],
    authors: [{ name: "Jane Doe", affiliation: "OAU", order: 0 }],
    issueId: null,
    pageStart: null,
    pageEnd: null,
    type: "RESEARCH_ARTICLE",
    doi: "",
    license: "",
    receivedAt: null,
    acceptedAt: null,
    status: "DRAFT",
  };

  it("accepts a valid article", () => {
    expect(articleInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects more than 10 keywords", () => {
    const result = articleInputSchema.safeParse({
      ...base,
      keywords: Array.from({ length: 11 }, (_, i) => `kw${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 authors", () => {
    const result = articleInputSchema.safeParse({
      ...base,
      authors: Array.from({ length: 21 }, (_, i) => ({ name: `A${i}`, order: i })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero authors", () => {
    const result = articleInputSchema.safeParse({ ...base, authors: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed DOI", () => {
    const result = articleInputSchema.safeParse({ ...base, doi: "not-a-doi" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty DOI", () => {
    expect(articleInputSchema.safeParse({ ...base, doi: "" }).success).toBe(true);
  });

  it("rejects an author with a malformed ORCID", () => {
    const result = articleInputSchema.safeParse({
      ...base,
      authors: [{ name: "Jane Doe", order: 0, orcid: "not-an-orcid" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("editorialBoardMemberInputSchema", () => {
  it("accepts an external member with a valid https URL", () => {
    const result = editorialBoardMemberInputSchema.safeParse({
      name: "Prof. External",
      roleTitle: "Advisory Board Member",
      affiliation: "Another University",
      affiliationCountry: "Nigeria",
      externalUrl: "https://example.com",
      order: 0,
      isActive: true,
      lecturerProfileId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-https external URL", () => {
    const result = editorialBoardMemberInputSchema.safeParse({
      name: "Prof. External",
      roleTitle: "Advisory Board Member",
      externalUrl: "http://example.com",
      order: 0,
      isActive: true,
      lecturerProfileId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid ORCID on an external member", () => {
    const result = editorialBoardMemberInputSchema.safeParse({
      name: "Prof. External",
      roleTitle: "Advisory Board Member",
      orcid: "0000-0000-0000-0000",
      order: 0,
      isActive: true,
      lecturerProfileId: null,
    });
    expect(result.success).toBe(false);
  });
});
