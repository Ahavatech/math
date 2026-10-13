import { describe, expect, it } from "vitest";
import { validateCourseImportCsv } from "../course-import";

const HEADER = "code,title,units,level,semester,programme,elective,prerequisites,description";

function csv(rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

async function noExisting() {
  return false;
}

describe("validateCourseImportCsv", () => {
  it("accepts a valid row with no prerequisites", async () => {
    const result = await validateCourseImportCsv(csv(["MTH 101,Calculus I,3,100,FIRST,BSC,false,,Intro course"]), {
      codeExists: noExisting,
    });
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].code).toBe("MTH 101");
  });

  it("resolves semicolon-separated prerequisite codes within the same file", async () => {
    const result = await validateCourseImportCsv(
      csv(["MTH 101,Calculus I,3,100,FIRST,BSC,false,,Intro", "MTH 201,Calculus II,3,200,FIRST,BSC,false,MTH 101,Advanced"]),
      { codeExists: noExisting },
    );
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[1].prerequisiteCodes).toEqual(["MTH 101"]);
  });

  it("flags an unknown prerequisite code (neither in this file nor existing)", async () => {
    const result = await validateCourseImportCsv(csv(["MTH 201,Calculus II,3,200,FIRST,BSC,false,MTH 999,Advanced"]), {
      codeExists: noExisting,
    });
    expect(result.errors.some((e) => /MTH 999/.test(e.reason))).toBe(true);
  });

  it("flags a duplicate code within the file", async () => {
    const result = await validateCourseImportCsv(
      csv(["MTH 101,Calculus I,3,100,FIRST,BSC,false,,A", "MTH 101,Calculus I Again,3,100,FIRST,BSC,false,,B"]),
      { codeExists: noExisting },
    );
    expect(result.errors.some((e) => /duplicate/i.test(e.reason))).toBe(true);
  });

  it("flags a code that already exists in the database", async () => {
    const result = await validateCourseImportCsv(csv(["MTH 101,Calculus I,3,100,FIRST,BSC,false,,A"]), {
      codeExists: async (code) => code === "MTH 101",
    });
    expect(result.errors.some((e) => /already exists/i.test(e.reason))).toBe(true);
  });

  it("flags a cycle created entirely within the file", async () => {
    const result = await validateCourseImportCsv(
      csv(["MTH 101,A,3,100,FIRST,BSC,false,MTH 201,desc", "MTH 201,B,3,200,FIRST,BSC,false,MTH 101,desc"]),
      { codeExists: noExisting },
    );
    expect(result.errors.some((e) => /cycle/i.test(e.reason))).toBe(true);
  });

  it("rejects more than 500 data rows", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => `TST ${100 + i},Course ${i},3,100,FIRST,BSC,false,,desc`);
    await expect(validateCourseImportCsv(csv(rows), { codeExists: noExisting })).rejects.toThrow(/500/);
  });

  it("flags invalid units, level and semester with per-row errors", async () => {
    const result = await validateCourseImportCsv(csv(["MTH 101,Calculus I,99,100,FIRST,BSC,false,,A"]), {
      codeExists: noExisting,
    });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.validRows).toHaveLength(0);
  });
});
