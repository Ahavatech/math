import { describe, expect, it } from "vitest";
import { donationsSettingsSchema, DONATIONS_DEFAULT } from "../donations";

const complete = {
  enabled: true,
  heading: "Support the department",
  intro: "Gifts help students.",
  purposes: [{ title: "Student bursaries", description: "Help with fees." }],
  accountName: "Department of Mathematics Gifts",
  bankName: "Example Bank",
  accountNumber: "0123456789",
  swiftCode: "EXAMNGLA",
  reference: "Your name and the word Mathematics",
  receiptsNote: "Email us for a receipt.",
  contactEmail: "maths@example.com",
};

describe("donationsSettingsSchema", () => {
  it("accepts a complete, enabled configuration", () => {
    expect(donationsSettingsSchema.safeParse(complete).success).toBe(true);
  });

  it("accepts the default, which is switched off and empty", () => {
    expect(DONATIONS_DEFAULT.enabled).toBe(false);
    expect(donationsSettingsSchema.safeParse(DONATIONS_DEFAULT).success).toBe(true);
  });

  it("refuses to turn the page on without account name, bank and account number", () => {
    for (const missing of ["accountName", "bankName", "accountNumber"] as const) {
      const result = donationsSettingsSchema.safeParse({ ...complete, [missing]: "" });
      expect(result.success, `missing ${missing}`).toBe(false);
    }
  });

  it("allows incomplete details while the page is switched off", () => {
    const result = donationsSettingsSchema.safeParse({ ...complete, enabled: false, accountNumber: "" });
    expect(result.success).toBe(true);
  });

  it("allows only digits, letters, spaces and hyphens in an account number", () => {
    expect(donationsSettingsSchema.safeParse({ ...complete, accountNumber: "0123 4567-89" }).success).toBe(true);
    expect(donationsSettingsSchema.safeParse({ ...complete, accountNumber: "0123<script>" }).success).toBe(false);
    expect(donationsSettingsSchema.safeParse({ ...complete, accountNumber: "0123\n4567" }).success).toBe(false);
  });

  it("limits the SWIFT code to letters and digits", () => {
    expect(donationsSettingsSchema.safeParse({ ...complete, swiftCode: "EXAMNGLA" }).success).toBe(true);
    expect(donationsSettingsSchema.safeParse({ ...complete, swiftCode: "EXAM NG" }).success).toBe(false);
  });

  it("accepts an empty contact email and rejects a malformed one", () => {
    expect(donationsSettingsSchema.safeParse({ ...complete, contactEmail: "" }).success).toBe(true);
    expect(donationsSettingsSchema.safeParse({ ...complete, contactEmail: "not-an-email" }).success).toBe(false);
  });

  it("caps the number of purposes and requires each one to have a title", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ title: `Purpose ${i}`, description: "" }));
    expect(donationsSettingsSchema.safeParse({ ...complete, purposes: nine }).success).toBe(false);
    expect(
      donationsSettingsSchema.safeParse({ ...complete, purposes: [{ title: "", description: "x" }] }).success,
    ).toBe(false);
  });

  it("bounds the length of free text", () => {
    expect(donationsSettingsSchema.safeParse({ ...complete, intro: "x".repeat(3001) }).success).toBe(false);
  });
});
