import "server-only";
import type { ContactMessageStatus, ContactMessageType, PrismaClient } from "@prisma/client";
import { contactMessageSchema } from "@/lib/validators/contact";
import { extractAlumniRef } from "@/lib/alumni-reference";
import { findAlumniEntryByReference } from "./alumni-entries";
import { logAction, type AuditRequestContext } from "./audit";

/**
 * A minimal public contact-form intake, built here because Stage 09's
 * alumni removal-request flow depends on it existing. Stage 10 adds the
 * admin inbox (listContactMessagesAdmin, getContactMessageAdmin,
 * setContactMessageStatus) and the alumni-reference resolution below.
 */
export async function createContactMessage(db: PrismaClient, input: unknown) {
  const parsed = contactMessageSchema.parse(input);
  return db.contactMessage.create({ data: parsed });
}

export async function listContactMessagesAdmin(
  db: PrismaClient,
  filters: { status?: ContactMessageStatus; type?: ContactMessageType; q?: string } = {},
) {
  return db.contactMessage.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
              { subject: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Opening a NEW message marks it READ, audit-logged once (re-opening an already-read message is a no-op). */
export async function getContactMessageAdmin(db: PrismaClient, id: string, actorId: string, context?: AuditRequestContext) {
  const message = await db.contactMessage.findUniqueOrThrow({ where: { id } });
  if (message.status !== "NEW") return message;

  return db.$transaction(async (tx) => {
    const updated = await tx.contactMessage.update({ where: { id }, data: { status: "READ" } });
    await logAction(
      tx,
      { actorId, action: "contact_message.read", entityType: "ContactMessage", entityId: id, summary: "Opened message" },
      context,
    );
    return updated;
  });
}

export async function setContactMessageStatus(
  db: PrismaClient,
  id: string,
  status: ContactMessageStatus,
  actorId: string,
  context?: AuditRequestContext,
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.contactMessage.update({ where: { id }, data: { status } });
    await logAction(
      tx,
      { actorId, action: "contact_message.set_status", entityType: "ContactMessage", entityId: id, summary: `Set status to ${status}` },
      context,
    );
    return updated;
  });
}

/**
 * For an ALUMNI-type message, extracts the reference the public alumni
 * card embedded and resolves it to the entry so the admin can jump
 * straight to withdrawing or erasing it. Returns null for any other
 * type, or when no reference is found/matches.
 */
export async function resolveAlumniRefForMessage(db: PrismaClient, message: { type: ContactMessageType; subject: string; message: string }) {
  if (message.type !== "ALUMNI") return null;
  const ref = extractAlumniRef(message.subject, message.message);
  if (!ref) return null;
  return findAlumniEntryByReference(db, ref);
}
