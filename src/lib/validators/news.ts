import { z } from "zod";

export const newsPostInputSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["ANNOUNCEMENT", "ACHIEVEMENT", "ADMISSION", "RESEARCH"]),
  excerpt: z.string().max(300).default(""),
  body: z.string(),
  coverId: z.string().nullable(),
  isPinned: z.boolean().default(false),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.date().nullable(),
});
export type NewsPostInput = z.infer<typeof newsPostInputSchema>;

export const newsSlugFormSchema = z.object({
  slug: z.string().min(1),
});
