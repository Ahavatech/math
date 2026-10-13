import { z } from "zod";

export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email"),
  type: z.enum(["ADMISSIONS", "RESEARCH", "COLLABORATION", "ALUMNI", "GENERAL"]),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
