import { z } from "zod";
import { LecturerRank } from "@prisma/client";
import { isAllowedProfileUrl, isValidOrcid } from "@/lib/lecturer-links";

function optionalUrl(field: "scholar" | "researchGate" | "linkedin") {
  return z
    .string()
    .default("")
    .refine((v) => v === "" || isAllowedProfileUrl(v, field), {
      message: `Must be an https URL on the allowed host for this field`,
    });
}

/**
 * Every field a lecturer may change on their own profile. Deliberately a
 * plain z.object (not .strict()), so parse() silently drops any extra
 * key the client sends - including every admin-only field below - which
 * is what a mass-assignment attempt actually hits: the stripped result
 * never reaches the database write.
 */
export const lecturerSelfEditSchema = z.object({
  photoId: z.string().nullable().default(null),
  honorific: z.string().max(50).default(""),
  bio: z.string().default(""),
  researchAreaIds: z.array(z.string()).default([]),
  officeLocation: z.string().max(200).default(""),
  officeHours: z.string().max(200).default(""),
  publicEmail: z.union([z.string().email(), z.literal("")]).default(""),
  phone: z.string().max(50).default(""),
  scholarUrl: optionalUrl("scholar"),
  orcid: z
    .string()
    .default("")
    .refine((v) => v === "" || isValidOrcid(v), { message: "Must be a valid ORCID iD" }),
  researchGateUrl: optionalUrl("researchGate"),
  linkedinUrl: optionalUrl("linkedin"),
  supervisionText: z.string().default(""),
});
export type LecturerSelfEditInput = z.infer<typeof lecturerSelfEditSchema>;

/** Everything only an admin can change. Never derived from lecturer input. */
export const lecturerAdminEditSchema = z.object({
  slug: z.string().min(1),
  rank: z.nativeEnum(LecturerRank),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  order: z.number().int(),
  isEmeritus: z.boolean(),
});
export type LecturerAdminEditInput = z.infer<typeof lecturerAdminEditSchema>;

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

export const publicationSchema = z.object({
  title: z.string().min(1).max(500),
  authorsText: z.string().min(1).max(500),
  venue: z.string().max(300).default(""),
  year: z.number().int().min(1900).max(2100),
  url: z
    .string()
    .default("")
    .refine((v) => v === "" || (v.startsWith("https://") && isValidUrl(v)), {
      message: "Must be an https URL",
    }),
  doi: z
    .string()
    .default("")
    .refine((v) => v === "" || DOI_PATTERN.test(v), { message: "Must be a valid DOI (e.g. 10.1000/xyz123)" }),
});
export type PublicationInput = z.infer<typeof publicationSchema>;

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
