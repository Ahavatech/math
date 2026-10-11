import { describe, expect, it } from "vitest";
import { validateLecturerImportCsv } from "../lecturer-import";

const HEADER = "fullName,honorific,rank,email";

describe("validateLecturerImportCsv", () => {
  it("accepts a valid row", async () => {
    const csv = `${HEADER}\nJane Doe,Dr.,Senior Lecturer,jane@example.com`;
    const result = await validateLecturerImportCsv(csv, { emailExists: async () => false });
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({ fullName: "Jane Doe", rank: "SENIOR_LECTURER", email: "jane@example.com" });
    expect(result.errors).toHaveLength(0);
  });

  it("reports a bad email", async () => {
    const csv = `${HEADER}\nJane Doe,Dr.,Professor,not-an-email`;
    const result = await validateLecturerImportCsv(csv, { emailExists: async () => false });
    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/email/i) });
  });

  it("reports an unknown/ambiguous rank instead of guessing", async () => {
    const csv = `${HEADER}\nJane Doe,Dr.,Lecturer,jane@example.com`;
    const result = await validateLecturerImportCsv(csv, { emailExists: async () => false });
    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/rank/i) });
  });

  it("reports a duplicate email within the file", async () => {
    const csv = `${HEADER}\nJane Doe,Dr.,Professor,same@example.com\nJohn Doe,Dr.,Professor,same@example.com`;
    const result = await validateLecturerImportCsv(csv, { emailExists: async () => false });
    expect(result.validRows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ row: 3, reason: expect.stringMatching(/duplicate/i) });
  });

  it("reports an email that already exists as a lecturer in the database", async () => {
    const csv = `${HEADER}\nJane Doe,Dr.,Professor,existing@example.com`;
    const result = await validateLecturerImportCsv(csv, { emailExists: async (email) => email === "existing@example.com" });
    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/already/i) });
  });

  it("reports a missing full name", async () => {
    const csv = `${HEADER}\n,Dr.,Professor,jane@example.com`;
    const result = await validateLecturerImportCsv(csv, { emailExists: async () => false });
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/name/i) });
  });

  it("rejects a file over the 200-row cap outright", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => `Person ${i},Dr.,Professor,person${i}@example.com`);
    const csv = `${HEADER}\n${rows.join("\n")}`;
    await expect(validateLecturerImportCsv(csv, { emailExists: async () => false })).rejects.toThrow(/200/);
  });

  it("accepts exactly 200 rows", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => `Person ${i},Dr.,Professor,person${i}@example.com`);
    const csv = `${HEADER}\n${rows.join("\n")}`;
    const result = await validateLecturerImportCsv(csv, { emailExists: async () => false });
    expect(result.validRows).toHaveLength(200);
  });

  it("rejects a file with the wrong header", async () => {
    await expect(
      validateLecturerImportCsv("name,role\nJane,Prof", { emailExists: async () => false }),
    ).rejects.toThrow(/header|column/i);
  });
});
