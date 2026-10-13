import { z } from "zod";

/** A single-line field (name, subject): no angle brackets, no control characters at all, not even newlines. */
const plainTextLine = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .refine((v) => !/[<>]/.test(v) && !/[\u0000-\u001f\u007f]/.test(v), {
      message: "Plain text only",
    });

/** A multi-line field (the message body): no angle brackets, no control characters except newlines. */
const plainTextBlock = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .refine((v) => !/[<>]/.test(v) && !/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/.test(v), {
      message: "Plain text only",
    });

export const contactMessageSchema = z.object({
  name: plainTextLine(120, "Name"),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email"),
  type: z.enum(["ADMISSIONS", "RESEARCH", "COLLABORATION", "ALUMNI", "GENERAL"]),
  subject: plainTextLine(200, "Subject"),
  message: plainTextBlock(4000, "Message"),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

/** The spam-control fields added on top of the message fields themselves, mirroring src/lib/validators/alumni.ts's pattern. */
export const contactSubmissionSchema = contactMessageSchema.extend({
  honeypot: z.string().optional().default(""),
  formToken: z.string().min(1),
  formRenderedAt: z.number(),
});

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;
