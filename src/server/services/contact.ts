import "server-only";
import type { PrismaClient } from "@prisma/client";
import { contactMessageSchema } from "@/lib/validators/contact";

/**
 * A minimal public contact-form intake, built here because this stage's
 * alumni removal-request flow depends on it existing (docs/prompts/09-alumni.md
 * section 6: "the contact form with type ALUMNI and a prefilled reference
 * makes the request"). No admin inbox UI exists yet for ContactMessage
 * rows - see AUDIT.md's open issues for this stage. The admin removal
 * procedure (docs/ALUMNI.md) currently requires reading the row directly
 * (e.g. via Prisma Studio) until a dedicated inbox is built.
 */
export async function createContactMessage(db: PrismaClient, input: unknown) {
  const parsed = contactMessageSchema.parse(input);
  return db.contactMessage.create({ data: parsed });
}
