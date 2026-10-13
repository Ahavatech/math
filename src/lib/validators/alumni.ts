import { z } from "zod";

const currentYear = new Date().getFullYear();

/** Unicode letters, marks (diacritics), spaces, apostrophes, hyphens and periods only - no angle brackets or control characters. */
const NAME_PATTERN = /^[\p{L}\p{M}\s'.-]+$/u;

export function normalizeAlumniName(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/g, " ");
}

function isLinkedinUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "linkedin.com" || url.hostname === "www.linkedin.com");
  } catch {
    return false;
  }
}

const name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name is too long")
  .transform(normalizeAlumniName)
  .refine((v) => NAME_PATTERN.test(v), {
    message: "Name may only contain letters, spaces, apostrophes, hyphens and periods",
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Too long")
    .refine((v) => !/[<>]/.test(v) && !/[\u0000-\u001f\u007f]/.test(v), {
      message: "Plain text only",
    })
    .default("");

const linkedinUrlField = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || isLinkedinUrl(v), {
    message: "LinkedIn link must be an https linkedin.com URL",
  });

/**
 * The directory-facing fields shared by the public submission form and
 * the admin's inline edit screen. Pulled out so an admin edit (which
 * can change `linkedinUrl` before this stage's only check was the
 * submission form's own validator) is held to the exact same rules -
 * otherwise an admin account could save a `javascript:` URL that the
 * public alumni card then renders directly into an `<a href>`.
 */
export const alumniEditableFieldsSchema = z.object({
  fullName: name,
  email: z.string().trim().toLowerCase().max(254, "Email is too long").email("Enter a valid email"),
  level: z.enum(["BSC", "MSC"]),
  graduationYear: z
    .number()
    .int()
    .min(1965, "Graduation year must be 1965 or later")
    .max(currentYear, "Graduation year cannot be in the future"),
  organisation: optionalText(120),
  roleTitle: optionalText(120),
  city: optionalText(120),
  country: optionalText(120),
  industry: optionalText(120),
  linkedinUrl: linkedinUrlField,
});

export const alumniSubmissionSchema = alumniEditableFieldsSchema.extend({
  consent: z.literal(true, { message: "You must agree before submitting" }),
  honeypot: z.string().optional().default(""),
  formToken: z.string().min(1),
  formRenderedAt: z.number(),
});

export type AlumniSubmissionInput = z.infer<typeof alumniSubmissionSchema>;
export type AlumniEditableFields = z.infer<typeof alumniEditableFieldsSchema>;
