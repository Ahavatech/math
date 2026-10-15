import { z } from "zod";

/**
 * CV is deliberately excluded from the admin-manageable category list:
 * CV downloads are created only through the lecturer CV upload pipeline
 * (src/server/services/lecturer-cv.ts) and must never appear in the
 * general-purpose /students/downloads admin or public listing.
 */
export const ADMIN_DOWNLOAD_CATEGORIES = ["HANDBOOK", "FORM", "GUIDELINE", "TIMETABLE", "OTHER"] as const;
export type AdminDownloadCategory = (typeof ADMIN_DOWNLOAD_CATEGORIES)[number];

export const downloadInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(500).default(""),
  category: z.enum(ADMIN_DOWNLOAD_CATEGORIES),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export type DownloadInput = z.infer<typeof downloadInputSchema>;
