import { z } from "zod";

const plainText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .refine((v) => !/[<>]/.test(v) && !/[\u0000-\u001f\u007f]/.test(v), {
      message: "Plain text only",
    });

export const contactMessageSchema = z.object({
  name: plainText(120, "Name"),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email"),
  type: z.enum(["ADMISSIONS", "RESEARCH", "COLLABORATION", "ALUMNI", "GENERAL"]),
  subject: plainText(200, "Subject"),
  message: plainText(4000, "Message"),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

/** The spam-control fields added on top of the message fields themselves, mirroring src/lib/validators/alumni.ts's pattern. */
export const contactSubmissionSchema = contactMessageSchema.extend({
  honeypot: z.string().optional().default(""),
  formToken: z.string().min(1),
  formRenderedAt: z.number(),
});

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
