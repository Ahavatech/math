import { z } from "zod";

export const handbookPageInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  summary: z.string().trim().max(300).default(""),
  body: z.string().default(""),
  parentId: z.string().nullable().default(null),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export type HandbookPageInput = z.infer<typeof handbookPageInputSchema>;
