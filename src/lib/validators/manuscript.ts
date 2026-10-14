import { z } from "zod";

export const registerAuthorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().email("Valid email required"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  privacyConsent: z.literal(true, { errorMap: () => ({ message: "You must accept the privacy notice" }) }),
  honeypot: z.string().max(0, "Unexpected input"),
  formToken: z.string(),
  formRenderedAt: z.number().int(),
});
export type RegisterAuthorInput = z.infer<typeof registerAuthorSchema>;
