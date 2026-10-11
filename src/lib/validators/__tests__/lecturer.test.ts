import { describe, expect, it } from "vitest";
import {
  lecturerSelfEditSchema,
  lecturerAdminEditSchema,
  publicationSchema,
} from "../lecturer";

const validSelfEdit = {
  photoId: null,
  honorific: "Dr.",
  bio: "<p>Bio</p>",
  researchAreaIds: ["area-1"],
  officeLocation: "Room 12",
  officeHours: "Mon-Fri 10-12",
  publicEmail: "jane@example.com",
  phone: "08000000000",
  scholarUrl: "",
  orcid: "",
  researchGateUrl: "",
  linkedinUrl: "",
  supervisionText: "<p>Taking students</p>",
};

describe("lecturerSelfEditSchema", () => {
  it("accepts a valid payload", () => {
    expect(lecturerSelfEditSchema.parse(validSelfEdit)).toMatchObject({ honorific: "Dr." });
  });

  it("strips fields a lecturer must not be able to set (mass assignment)", () => {
    const result = lecturerSelfEditSchema.parse({
      ...validSelfEdit,
      userId: "someone-elses-id",
      slug: "hacked-slug",
      rank: "PROFESSOR",
      status: "PUBLISHED",
      order: 999,
      isEmeritus: true,
      publishRequestedAt: new Date().toISOString(),
    }) as Record<string, unknown>;

    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("slug");
    expect(result).not.toHaveProperty("rank");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("order");
    expect(result).not.toHaveProperty("isEmeritus");
    expect(result).not.toHaveProperty("publishRequestedAt");
  });

  it("rejects an invalid public email", () => {
    expect(() => lecturerSelfEditSchema.parse({ ...validSelfEdit, publicEmail: "not-an-email" })).toThrow();
  });

  it("accepts an empty public email (not shown publicly when empty)", () => {
    expect(lecturerSelfEditSchema.parse({ ...validSelfEdit, publicEmail: "" }).publicEmail).toBe("");
  });

  it("rejects a scholar URL on the wrong host", () => {
    expect(() =>
      lecturerSelfEditSchema.parse({ ...validSelfEdit, scholarUrl: "https://evil.example/x" }),
    ).toThrow();
  });

  it("rejects a javascript: URL in any link field", () => {
    expect(() =>
      lecturerSelfEditSchema.parse({ ...validSelfEdit, linkedinUrl: "javascript:alert(1)" }),
    ).toThrow();
  });

  it("rejects a malformed ORCID", () => {
    expect(() => lecturerSelfEditSchema.parse({ ...validSelfEdit, orcid: "not-an-orcid" })).toThrow();
  });

  it("accepts a valid ORCID", () => {
    expect(
      lecturerSelfEditSchema.parse({ ...validSelfEdit, orcid: "0000-0002-1825-0097" }).orcid,
    ).toBe("0000-0002-1825-0097");
  });
});

describe("lecturerAdminEditSchema", () => {
  it("accepts the admin-only fields", () => {
    const result = lecturerAdminEditSchema.parse({
      slug: "jane-doe",
      rank: "SENIOR_LECTURER",
      status: "PUBLISHED",
      order: 3,
      isEmeritus: false,
    });
    expect(result.slug).toBe("jane-doe");
  });

  it("rejects an unknown rank", () => {
    expect(() =>
      lecturerAdminEditSchema.parse({ slug: "x", rank: "NOT_A_RANK", status: "DRAFT", order: 0, isEmeritus: false }),
    ).toThrow();
  });
});

describe("publicationSchema", () => {
  const base = { title: "A Paper", authorsText: "Doe, J.", venue: "", year: 2020, url: "", doi: "" };

  it("accepts a minimal valid publication", () => {
    expect(publicationSchema.parse(base).title).toBe("A Paper");
  });

  it("rejects a non-https url", () => {
    expect(() => publicationSchema.parse({ ...base, url: "http://example.com" })).toThrow();
  });

  it("rejects a malformed DOI", () => {
    expect(() => publicationSchema.parse({ ...base, doi: "not-a-doi" })).toThrow();
  });

  it("accepts a well-formed DOI", () => {
    expect(publicationSchema.parse({ ...base, doi: "10.1000/xyz123" }).doi).toBe("10.1000/xyz123");
  });

  it("rejects a year out of range", () => {
    expect(() => publicationSchema.parse({ ...base, year: 1500 })).toThrow();
  });
});
