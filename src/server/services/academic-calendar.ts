import "server-only";
import type { AcademicCalendarEntry, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { generateAllDayIcsFeed } from "@/lib/ics";
import { logAction, type AuditRequestContext } from "./audit";

const calendarEntryInputSchema = z
  .object({
    session: z.string().trim().min(1, "Session is required").max(20),
    title: z.string().trim().min(1, "Title is required").max(200),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().nullable().default(null),
    description: z.string().trim().max(1000).default(""),
  })
  .refine((data) => !data.endDate || new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export async function createCalendarEntry(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AcademicCalendarEntry> {
  const parsed = calendarEntryInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const created = await tx.academicCalendarEntry.create({
      data: {
        session: parsed.session,
        title: parsed.title,
        startDate: new Date(parsed.startDate),
        endDate: parsed.endDate ? new Date(parsed.endDate) : null,
        description: parsed.description || null,
      },
    });
    await logAction(
      tx,
      { actorId, action: "calendar.create", entityType: "AcademicCalendarEntry", entityId: created.id, summary: `Created ${created.title}` },
      context,
    );
    return created;
  });
}

export async function updateCalendarEntry(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AcademicCalendarEntry> {
  const parsed = calendarEntryInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const updated = await tx.academicCalendarEntry.update({
      where: { id },
      data: {
        session: parsed.session,
        title: parsed.title,
        startDate: new Date(parsed.startDate),
        endDate: parsed.endDate ? new Date(parsed.endDate) : null,
        description: parsed.description || null,
      },
    });
    await logAction(
      tx,
      { actorId, action: "calendar.update", entityType: "AcademicCalendarEntry", entityId: id, summary: `Updated ${updated.title}` },
      context,
    );
    return updated;
  });
}

export async function deleteCalendarEntry(db: PrismaClient, id: string, actorId: string, context?: AuditRequestContext): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.academicCalendarEntry.delete({ where: { id } });
    await logAction(
      tx,
      { actorId, action: "calendar.delete", entityType: "AcademicCalendarEntry", entityId: id, summary: "Deleted calendar entry" },
      context,
    );
  });
}

export async function listCalendarEntriesAdmin(db: PrismaClient) {
  return db.academicCalendarEntry.findMany({ orderBy: { startDate: "asc" } });
}

/**
 * The academic calendar has no DRAFT/PUBLISHED status (unlike every
 * other content type) - an entry is either on the calendar or it
 * isn't, matching the prompt's plain CRUD spec. Wrapped in try/catch
 * per PATTERNS.md so a page using this still builds if the database is
 * briefly unreachable.
 */
export async function listCalendarEntriesPublic(db: PrismaClient) {
  try {
    return await db.academicCalendarEntry.findMany({ orderBy: { startDate: "asc" } });
  } catch {
    return [];
  }
}

export function buildCalendarIcsFeed(entries: Pick<AcademicCalendarEntry, "id" | "title" | "description" | "startDate" | "endDate">[]): string {
  return generateAllDayIcsFeed(
    entries.map((e) => ({ id: e.id, title: e.title, description: e.description ?? "", startDate: e.startDate, endDate: e.endDate })),
  );
}
