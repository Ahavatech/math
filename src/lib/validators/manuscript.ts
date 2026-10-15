import { z } from "zod";

export const registerAuthorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().email("Valid email required"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  privacyConsent: z.literal(true, { message: "You must accept the privacy notice" }),
  honeypot: z.string().max(0, "Unexpected input"),
  formToken: z.string(),
  formRenderedAt: z.number().int(),
});
export type RegisterAuthorInput = z.infer<typeof registerAuthorSchema>;

// Wizard step validators

export const step1Schema = z.object({
  articleType: z.enum(["RESEARCH_ARTICLE", "REVIEW", "SHORT_COMMUNICATION", "OTHER"]),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(300, "Title must not exceed 300 characters")
    .refine((v) => !/[<>]/.test(v), "Title must not contain angle brackets"),
  abstract: z
    .string()
    .trim()
    .min(1, "Abstract is required")
    .max(3000, "Abstract must not exceed 3000 characters"),
  keywords: z
    .array(z.string().trim().min(1).max(100))
    .min(3, "At least 3 keywords are required")
    .max(10, "Maximum 10 keywords"),
});
export type Step1Input = z.infer<typeof step1Schema>;

export const authorEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  affiliation: z.string().trim().max(300).optional(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  orcid: z.string().optional(),
  isCorresponding: z.boolean(),
});

export const step2Schema = z
  .object({
    authors: z.array(authorEntrySchema).min(1).max(20),
  })
  .refine(
    (data) => data.authors.filter((a) => a.isCorresponding).length === 1,
    "Exactly one corresponding author is required",
  );
export type Step2Input = z.infer<typeof step2Schema>;

export const reviewerEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  affiliation: z.string().trim().max(300).optional(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
});

export const step3Schema = z.object({
  coverLetter: z.string().trim().min(1, "Cover letter is required").max(5000),
  suggestedReviewers: z.array(reviewerEntrySchema).max(5).default([]),
  excludedReviewers: z.array(reviewerEntrySchema).max(5).default([]),
  anonymisedConfirmed: z.literal(true, { message: "You must confirm anonymisation" }),
});
export type Step3Input = z.infer<typeof step3Schema>;

export const step4Schema = z.object({
  agreementVersion: z.literal("JOURNAL_AUTHOR_AGREEMENT_V1"),
  agreementAcceptedAt: z.string().datetime(),
});
export type Step4Input = z.infer<typeof step4Schema>;
