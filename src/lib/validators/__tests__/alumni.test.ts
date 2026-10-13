import { describe, expect, it } from "vitest";
import { alumniSubmissionSchema, normalizeAlumniName } from "../alumni";

const currentYear = new Date().getFullYear();

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    fullName: "Ọlá Adéṣọlá",
    email: "ola@example.com",
    level: "BSC",
    graduationYear: 2010,
    organisation: "Example Ltd",
    roleTitle: "Analyst",
    city: "Lagos",
    country: "Nigeria",
    industry: "Information technology",
    linkedinUrl: "",
    consent: true,
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
    const result = alumniSubmissionSchema.safeParse(baseInput({ graduationYear: 1964 }));
    expect(result.success).toBe(false);
  });

  it("rejects a graduation year after the current year", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ graduationYear: currentYear + 1 }));
    expect(result.success).toBe(false);
  });

  it("accepts the current year as a graduation year", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ graduationYear: currentYear }));
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

  it("requires consent to be true", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ consent: false }));
    expect(result.success).toBe(false);
  });

  it("enforces a maximum length on organisation, roleTitle, city, country and industry", () => {
    for (const field of ["organisation", "roleTitle", "city", "country", "industry"]) {
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

  it("requires level to be BSC or MSC", () => {
    const result = alumniSubmissionSchema.safeParse(baseInput({ level: "PHD" }));
    expect(result.success).toBe(false);
  });
});
