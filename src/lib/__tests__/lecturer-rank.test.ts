import { describe, expect, it } from "vitest";
import { parseRank } from "../lecturer-rank";

describe("parseRank", () => {
  it("parses exact enum values case-insensitively", () => {
    expect(parseRank("PROFESSOR")).toBe("PROFESSOR");
    expect(parseRank("professor")).toBe("PROFESSOR");
  });

  it("parses common human labels", () => {
    expect(parseRank("Professor")).toBe("PROFESSOR");
    expect(parseRank("Prof")).toBe("PROFESSOR");
    expect(parseRank("Prof.")).toBe("PROFESSOR");
    expect(parseRank("Associate Professor")).toBe("ASSOCIATE_PROFESSOR");
    expect(parseRank("Assoc. Professor")).toBe("ASSOCIATE_PROFESSOR");
    expect(parseRank("Senior Lecturer")).toBe("SENIOR_LECTURER");
    expect(parseRank("Snr Lecturer")).toBe("SENIOR_LECTURER");
    expect(parseRank("Sr. Lecturer")).toBe("SENIOR_LECTURER");
    expect(parseRank("Lecturer I")).toBe("LECTURER_I");
    expect(parseRank("Lecturer 1")).toBe("LECTURER_I");
    expect(parseRank("Lecturer II")).toBe("LECTURER_II");
    expect(parseRank("Lecturer 2")).toBe("LECTURER_II");
    expect(parseRank("Assistant Lecturer")).toBe("ASSISTANT_LECTURER");
    expect(parseRank("Graduate Assistant")).toBe("GRADUATE_ASSISTANT");
  });

  it("trims whitespace", () => {
    expect(parseRank("  Professor  ")).toBe("PROFESSOR");
  });

  it("returns null for an ambiguous or unknown rank rather than guessing", () => {
    expect(parseRank("Lecturer")).toBeNull();
    expect(parseRank("")).toBeNull();
    expect(parseRank("Visiting Scholar")).toBeNull();
    expect(parseRank("Dr.")).toBeNull();
  });
});
