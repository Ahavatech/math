import { z } from "zod";

/** ISSN: NNNN-NNNN(X), check digit per the ISSN International Centre's modulus-11 algorithm. */
export function isValidIssn(value: string): boolean {
  if (!/^\d{4}-\d{3}[\dX]$/.test(value)) return false;
  const digits = value.replace("-", "");
  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(digits[i]) * weights[i];
  const check = (11 - (sum % 11)) % 11;
  const expected = check === 10 ? "X" : String(check);
  return digits[7] === expected;
}

/** ORCID iD: 0000-0000-0000-000X, checksum per ISO 7064 MOD 11-2. */
export function isValidOrcid(value: string): boolean {
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value)) return false;
  const digits = value.replace(/-/g, "");
  let total = 0;
  for (let i = 0; i < 15; i++) {
    total = (total + Number(digits[i])) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expected = result === 10 ? "X" : String(result);
  return digits[15] === expected;
}

/** DOI: "10." followed by a 4+ digit registrant code, a slash, and a non-empty suffix. */
export function isValidDoi(value: string): boolean {
  return /^10\.\d{4,9}(\.\d+)*\/\S+$/.test(value);
}

/** Trims, collapses internal whitespace, drops empties, dedupes case-insensitively, caps at 10. */
export function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of keywords) {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length === 10) break;
  }
  return result;
}

export const JOURNAL_LICENSES = [
  "CC BY 4.0",
  "CC BY-NC 4.0",
  "CC BY-SA 4.0",
  "All rights reserved",
  "Custom",
] as const;
export type JournalLicense = (typeof JOURNAL_LICENSES)[number];

export const ARTICLE_TYPES = [
  "RESEARCH_ARTICLE",
  "REVIEW",
  "SHORT_COMMUNICATION",
  "OTHER",
] as const;
export type ArticleTypeValue = (typeof ARTICLE_TYPES)[number];

const issnField = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidIssn(v), { message: "Must be empty or a valid ISSN (NNNN-NNNN with a correct check digit)" });

const orcidField = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidOrcid(v), { message: "Must be empty or a valid ORCID iD" })
  .optional();

const doiField = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidDoi(v), { message: "Must be empty or a DOI in the form 10.xxxx/suffix" });

const httpsUrlField = z
  .string()
  .trim()
  .refine((v) => v === "" || v.startsWith("https://"), { message: "Must be empty or start with https://" });

export const journalSettingsSchema = z.object({
  name: z.string().trim().default(""),
  shortName: z.string().trim().default(""),
  issn: issnField.default(""),
  eissn: issnField.default(""),
  publisher: z.string().trim().default(""),
  frequency: z.string().trim().default(""),
  license: z.enum(JOURNAL_LICENSES).default("All rights reserved"),
  licenseUrl: httpsUrlField.default(""),
  customLicenseText: z.string().trim().default(""),
  contactEmail: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, { message: "Must be empty or a valid email" })
    .default(""),
  submissionsOpen: z.boolean().default(false),
  citeAsPublisher: z.string().trim().default(""),
  reviewsRequired: z.number().int().min(1).max(10).default(2),
  reviewDueDays: z.number().int().min(1).max(365).default(21),
  invitationExpiryDays: z.number().int().min(1).max(90).default(14),
});
export type JournalSettings = z.infer<typeof journalSettingsSchema>;

export const articleAuthorInputSchema = z.object({
  name: z.string().trim().min(1, "Author name is required").max(200),
  affiliation: z.string().trim().max(300).optional(),
  orcid: orcidField,
  email: z.string().trim().email().optional().or(z.literal("")),
  order: z.number().int().min(0),
  userId: z.string().optional().nullable(),
});

export const articleInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  abstract: z.string().trim().min(1, "Abstract is required"),
  keywords: z.array(z.string()).max(10, "At most 10 keywords").default([]),
  authors: z
    .array(articleAuthorInputSchema)
    .min(1, "At least one author is required")
    .max(20, "At most 20 authors"),
  issueId: z.string().nullable().optional(),
  pageStart: z.number().int().positive().nullable().optional(),
  pageEnd: z.number().int().positive().nullable().optional(),
  type: z.enum(ARTICLE_TYPES).default("RESEARCH_ARTICLE"),
  doi: doiField.default(""),
  license: z.string().trim().default(""),
  receivedAt: z.string().nullable().optional(),
  acceptedAt: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

export const editorialBoardMemberInputSchema = z.object({
  lecturerProfileId: z.string().nullable(),
  name: z.string().trim().min(1, "Name is required").max(200),
  affiliation: z.string().trim().max(300).optional(),
  affiliationCountry: z.string().trim().max(100).optional(),
  orcid: orcidField,
  externalUrl: httpsUrlField.optional(),
  roleTitle: z.string().trim().min(1, "Role title is required").max(100),
  order: z.number().int().min(0),
  isActive: z.boolean().default(true),
});
export type EditorialBoardMemberInput = z.infer<typeof editorialBoardMemberInputSchema>;

export const journalIssueInputSchema = z.object({
  volume: z.number().int().positive(),
  number: z.number().int().positive(),
  year: z.number().int().min(1900).max(2200),
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});
export type JournalIssueInput = z.infer<typeof journalIssueInputSchema>;
