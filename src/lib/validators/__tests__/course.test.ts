import { describe, expect, it } from "vitest";
import { normalizeCourseCode, isValidCourseCode, courseInputSchema } from "../course";

describe("normalizeCourseCode", () => {
  it("normalises various spacings and cases to 'MTH 101'", () => {
    expect(normalizeCourseCode("mth101")).toBe("MTH 101");
    expect(normalizeCourseCode("MTH-101")).toBe("MTH 101");
    expect(normalizeCourseCode("mth 101")).toBe("MTH 101");
    expect(normalizeCourseCode(" Mth   101 ")).toBe("MTH 101");
  });
});

describe("isValidCourseCode", () => {
  it("accepts letters plus exactly three digits with one space", () => {
    expect(isValidCourseCode("MTH 101")).toBe(true);
    expect(isValidCourseCode("STA 201")).toBe(true);
  });

  it("rejects a code with the wrong digit count or no letters", () => {
    expect(isValidCourseCode("MTH 10")).toBe(false);
    expect(isValidCourseCode("MTH 1011")).toBe(false);
    expect(isValidCourseCode("101")).toBe(false);
  });
});

describe("courseInputSchema", () => {
  function baseInput(overrides: Record<string, unknown> = {}) {
    return {
      code: "mth 101",
      title: "Calculus I",
      units: 3,
      level: 100,
      semester: "FIRST",
      programmeLevel: "BSC",
      isElective: false,
      description: "",
      status: "DRAFT",
      ...overrides,
    };
  }

  it("accepts a valid course and normalises its code", () => {
    const result = courseInputSchema.parse(baseInput());
    expect(result.code).toBe("MTH 101");
  });

  it("rejects units outside 1-12", () => {
    expect(courseInputSchema.safeParse(baseInput({ units: 0 })).success).toBe(false);
    expect(courseInputSchema.safeParse(baseInput({ units: 13 })).success).toBe(false);
  });

  it("rejects a level outside 100-900", () => {
    expect(courseInputSchema.safeParse(baseInput({ level: 50 })).success).toBe(false);
    expect(courseInputSchema.safeParse(baseInput({ level: 950 })).success).toBe(false);
  });

  it("rejects an invalid code", () => {
    expect(courseInputSchema.safeParse(baseInput({ code: "123" })).success).toBe(false);
  });
});
