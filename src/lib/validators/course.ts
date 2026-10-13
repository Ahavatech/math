import { z } from "zod";

/** Normalises "mth101", "MTH-101", "mth 101" etc. to the canonical "MTH 101" form. */
export function normalizeCourseCode(input: string): string {
  const match = input.trim().toUpperCase().match(/^([A-Z]+)[\s-]*(\d{3})$/);
  if (!match) return input.trim().toUpperCase();
  return `${match[1]} ${match[2]}`;
}

export function isValidCourseCode(code: string): boolean {
  return /^[A-Z]+\s\d{3}$/.test(code);
}

export const courseInputSchema = z.object({
  code: z
    .string()
    .transform(normalizeCourseCode)
    .refine(isValidCourseCode, { message: "Course code must be letters followed by three digits, e.g. MTH 101" }),
  title: z.string().trim().min(1, "Title is required").max(200),
  units: z.number().int().min(1, "Units must be at least 1").max(12, "Units cannot exceed 12"),
  level: z.number().int().min(100, "Level must be at least 100").max(900, "Level cannot exceed 900"),
  semester: z.enum(["FIRST", "SECOND"]),
  programmeLevel: z.enum(["BSC", "MSC", "PHD"]),
  isElective: z.boolean().default(false),
  description: z.string().default(""),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export type CourseInput = z.infer<typeof courseInputSchema>;
