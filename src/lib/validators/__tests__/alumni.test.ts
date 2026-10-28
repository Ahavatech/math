import { describe, expect, it } from "vitest";
import { alumniSubmissionSchema, normalizeAlumniName } from "../alumni";

const currentYear = new Date().getFullYear();

const baseProgramme = { level: "BSC" as const, graduationYear: 2010 };

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    fullName: "Ọlá Adéṣọlá",
    email: "ola@example.com",
    programmes: [baseProgramme],
    organisation: "Example Ltd",
    roleOrField: "Analyst",
    city: "Lagos",
    country: "Nigeria",
    industry: "Information technology",
    linkedinUrl: "",
    note: "",
    consentPublicDisplay: true,
    honeypot: "",
    formToken: "token",
    formRenderedAt: Date.now() - 5000,
    ...overrides,
  };
}

describe("normalizeAlumniName", () => {
  it("normalises to NFC, trims, and collapses internal whitespace", () => {
    expect(normalizeAlumniName("  Ọlá   Adéṣọlá  ")).toBe("Ọlá Adéṣọlá".normalize("NFC"));
  });
});

describe("alumniSubmissionSchema", () => {
  it("accepts Yoruba diacritics, apostrophes, hyphens and periods in a name", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ fullName: "Ẹ̀bùn-Ṣóyẹmí O'Brien Jr." }));
    expect(result.success).toBe(true);
  });

  it("rejects a name containing angle brackets", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ fullName: "<script>alert(1)</script>" }));
    expect(result.success).toBe(false);
  });

  it("rejects a name containing control characters", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ fullName: "Ola\u0000Adesola" }));
    expect(result.success).toBe(false);
  });

  it("enforces a maximum length on fullName", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ fullName: "A".repeat(121) }));
    expect(result.success).toBe(false);
  });

  it("rejects a graduation year before 1965", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ programmes: [{ level: "BSC", graduationYear: 1964 }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a graduation year more than one year ahead", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ programmes: [{ level: "BSC", graduationYear: currentYear + 2 }] }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts the current year as a graduation year", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ programmes: [{ level: "BSC", graduationYear: currentYear }] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects programmes array with zero entries", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ programmes: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 programmes", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({
        programmes: [
          { level: "BSC", graduationYear: 2010 },
          { level: "MSC", graduationYear: 2013 },
          { level: "PHD", graduationYear: 2018 },
          { level: "BSC", graduationYear: 2020 },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts PHD as a valid level", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ programmes: [{ level: "PHD", graduationYear: 2015 }] }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts an empty linkedinUrl", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ linkedinUrl: "" }));
    expect(result.success).toBe(true);
  });

  it("accepts a valid linkedin.com https URL", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ linkedinUrl: "https://www.linkedin.com/in/example" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a javascript: URL for linkedinUrl", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ linkedinUrl: "javascript:alert(1)" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a data: URL for linkedinUrl", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ linkedinUrl: "data:text/html,x" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-linkedin host for linkedinUrl", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ linkedinUrl: "https://evil.example.com/linkedin.com" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an http (non-https) linkedinUrl", () => {
    const result = alumniSubmissionSchema.safeParse(
      baseInput({ linkedinUrl: "http://www.linkedin.com/in/example" }),
    );
    expect(result.success).toBe(false);
  });

  it("requires consentPublicDisplay to be true", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ consentPublicDisplay: false }));
    expect(result.success).toBe(false);
  });

  it("enforces a maximum length on organisation, roleOrField, city, country and industry", () => {
    for (const field of ["organisation", "roleOrField", "city", "country", "industry"]) {
      const result = alumniSubmissionSchema.safeParse(baseInput({ [field]: "A".repeat(121) }));
      expect(result.success, `${field} should be rejected past 120 chars`).toBe(false);
    }
  });

  it("enforces a maximum length and valid shape on email", () => {
    const tooLong = alumniSubmissionSchema.safeParse(
      baseInput({ email: `${"a".repeat(250)}@example.com` }),
    );
    expect(tooLong.success).toBe(false);

    const invalid = alumniSubmissionSchema.safeParse(baseInput({ email: "not-an-email" }));
    expect(invalid.success).toBe(false);
  });
});
