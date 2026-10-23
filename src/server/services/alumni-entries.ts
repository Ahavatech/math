import "server-only";
import type { AlumniEntry, AlumniStatus, Prisma, PrismaClient } from "@prisma/client";
import { computeDedupeKey } from "@/lib/alumni-dedupe";
import { ALUMNI_CONSENT_VERSION } from "@/lib/alumni-consent";
import { alumniPublicReference } from "@/lib/alumni-reference";
import { alumniEditableFieldsSchema, type AlumniProgrammeInput } from "@/lib/validators/alumni";
import { deleteAlumniPhoto } from "./alumni-photos";
import { logAction, type AuditRequestContext } from "./audit";

type Db = PrismaClient | Prisma.TransactionClient;

export type AlumniEntrySubmission = {
  fullName: string;
  email: string;
  programmes: AlumniProgrammeInput[];
  organisation?: string;
  roleOrField?: string;
  city?: string;
  country?: string;
  note?: string;
  industry?: string;
  linkedinUrl?: string;
};

export class IllegalTransitionError extends Error {
  constructor(from: AlumniStatus, to: string) {
    super(`Cannot move an alumni entry from ${from} to ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export async function submitAlumniEntry(
  db: Db,
  params: { linkId: string | null; data: AlumniEntrySubmission; photoMediaId: string | null; consentPublicDisplay: boolean },
): Promise<AlumniEntry> {
  const normalizedEmail = params.data.email.trim().toLowerCase();

  // Check for duplicate email — any status, any programme
  const existing = await db.alumniEntry.findFirst({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    // Flag on the first matching entry for admin visibility
    await db.alumniEntry.update({
      where: { id: existing.id },
      data: { isDuplicateEmail: true },
    });
    // Return the existing entry without creating a new one
    return db.alumniEntry.findUniqueOrThrow({ where: { id: existing.id } });
  }

  const dedupeKey = computeDedupeKey(params.data.fullName, params.data.programmes[0]?.graduationYear ?? 0);

  const entry = await db.alumniEntry.create({
    data: {
      fullName: params.data.fullName,
      email: normalizedEmail,
      organisation: params.data.organisation || null,
      roleOrField: params.data.roleOrField || null,
      city: params.data.city || null,
      country: params.data.country || null,
      note: params.data.note || null,
      industry: params.data.industry || null,
      linkedinUrl: params.data.linkedinUrl || null,
      photoId: params.photoMediaId,
      linkId: params.linkId,
      dedupeKey,
      consentAt: new Date(),
      consentVersion: ALUMNI_CONSENT_VERSION,
      consentPublicDisplay: params.consentPublicDisplay,
      status: "PENDING",
    },
  });

  await db.alumniProgramme.createMany({
    data: params.data.programmes.map((p) => ({
      alumnusId: entry.id,
      level: p.level,
      entryYear: p.entryYear ?? null,
      graduationYear: p.graduationYear,
    })),
  });

  return entry;
}

/** Flagging aid only, never an automatic merge: PENDING or APPROVED entries sharing a dedupeKey. */
export async function findPossibleDuplicates(
  db: Db,
  dedupeKey: string,
  excludeId?: string,
): Promise<AlumniEntry[]> {
  return db.alumniEntry.findMany({
    where: {
      dedupeKey,
      status: { in: ["PENDING", "APPROVED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/**
 * Resolves an opaque public reference back to its entry.
 */
export async function findAlumniEntryByReference(db: PrismaClient, ref: string): Promise<AlumniEntry | null> {
  const entries = await db.alumniEntry.findMany({ select: { id: true } });
  const match = entries.find((e) => alumniPublicReference(e.id) === ref);
  if (!match) return null;
  return db.alumniEntry.findUnique({ where: { id: match.id } });
}

/**
 * Full admin detail view for one entry, with programmes included.
 */
export async function getAlumniEntryAdmin(db: PrismaClient, id: string) {
  const entry = await db.alumniEntry.findUniqueOrThrow({
    where: { id },
    include: {
      photo: true,
      link: { select: { id: true, label: true } },
      programmes: { orderBy: { graduationYear: "asc" } },
    },
  });

  const photoUrl = entry.photo
    ? entry.photo.deliveryType === "upload"
      ? entry.photo.url
      : `/api/alumni-photo/${entry.id}`
    : null;

  const { photo: _photo, ...rest } = entry;
  return { ...rest, photoUrl };
}

export async function listAlumniEntriesAdmin(
  db: PrismaClient,
  status: AlumniStatus,
  filters?: { level?: "BSC" | "MSC" | "PHD"; graduationYear?: number },
) {
  const programmeFilter = filters?.level || filters?.graduationYear
    ? {
        some: {
          ...(filters.level ? { level: filters.level } : {}),
          ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
        },
      }
    : undefined;

  return db.alumniEntry.findMany({
    where: {
      status,
      ...(programmeFilter ? { programmes: programmeFilter } : {}),
    },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    include: {
      photo: true,
      link: { select: { id: true, label: true } },
      programmes: { orderBy: { graduationYear: "asc" } },
    },
  });
}

function assertTransition(current: AlumniStatus, allowed: AlumniStatus[], to: string) {
  if (!allowed.includes(current)) {
    throw new IllegalTransitionError(current, to);
  }
}

export async function approveAlumniEntry(
  db: Db,
  id: string,
  actorId: string,
  options: { feature?: boolean },
  context?: AuditRequestContext,
): Promise<AlumniEntry> {
  const existing = await db.alumniEntry.findUniqueOrThrow({ where: { id } });
  assertTransition(existing.status, ["PENDING"], "APPROVED");

  if (existing.photoId) {
    const { publishAlumniPhoto } = await import("./alumni-photos");
    await publishAlumniPhoto(db, existing.photoId);
  }

  const updated = await db.alumniEntry.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedById: actorId,
      reviewedAt: new Date(),
      isFeatured: options.feature ? true : existing.isFeatured,
      rejectionReason: null,
    },
  });

  await logAction(
    db,
    { actorId, action: "alumni_entry.approve", entityType: "AlumniEntry", entityId: id, summary: "Approved alumni entry" },
    context,
  );

  return updated;
}

export async function rejectAlumniEntry(
  db: Db,
  id: string,
  reason: string,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AlumniEntry> {
  const existing = await db.alumniEntry.findUniqueOrThrow({ where: { id } });
  assertTransition(existing.status, ["PENDING"], "REJECTED");

  if (existing.photoId) {
    await deleteAlumniPhoto(db, existing.photoId);
  }

  const updated = await db.alumniEntry.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      reviewedById: actorId,
      reviewedAt: new Date(),
      photoId: null,
    },
  });

  await logAction(
    db,
    { actorId, action: "alumni_entry.reject", entityType: "AlumniEntry", entityId: id, summary: "Rejected alumni entry" },
    context,
  );

  return updated;
}

export async function withdrawAlumniEntry(
  db: Db,
  id: string,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AlumniEntry> {
  const existing = await db.alumniEntry.findUniqueOrThrow({ where: { id } });
  assertTransition(existing.status, ["APPROVED"], "WITHDRAWN");

  const updated = await db.alumniEntry.update({
    where: { id },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });

  await logAction(
    db,
    { actorId, action: "alumni_entry.withdraw", entityType: "AlumniEntry", entityId: id, summary: "Withdrew alumni entry" },
    context,
  );

  return updated;
}

export async function restoreWithdrawnAlumniEntry(
  db: Db,
  id: string,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AlumniEntry> {
  const existing = await db.alumniEntry.findUniqueOrThrow({ where: { id } });
  assertTransition(existing.status, ["WITHDRAWN"], "APPROVED");

  const updated = await db.alumniEntry.update({
    where: { id },
    data: { status: "APPROVED", withdrawnAt: null },
  });

  await logAction(
    db,
    { actorId, action: "alumni_entry.restore", entityType: "AlumniEntry", entityId: id, summary: "Restored withdrawn alumni entry" },
    context,
  );

  return updated;
}

/** Permanently deletes the row and its photo. Caller must enforce the HOD/SUPER_ADMIN-only restriction. */
export async function eraseAlumniEntry(
  db: Db,
  id: string,
  actorId: string,
  context?: AuditRequestContext,
): Promise<void> {
  const existing = await db.alumniEntry.findUniqueOrThrow({ where: { id } });

  if (existing.photoId) {
    await deleteAlumniPhoto(db, existing.photoId);
  }

  await db.alumniEntry.delete({ where: { id } });

  await logAction(
    db,
    { actorId, action: "alumni_entry.erase", entityType: "AlumniEntry", entityId: id, summary: "Erased alumni entry permanently" },
    context,
  );
}

export async function markDuplicate(
  db: Db,
  id: string,
  existingId: string,
  action: "separate" | "replace" | "reject",
  actorId: string,
  context?: AuditRequestContext,
): Promise<void> {
  if (action === "separate") {
    await approveAlumniEntry(db, id, actorId, {}, context);
    return;
  }
  if (action === "reject") {
    await rejectAlumniEntry(db, id, "Marked as duplicate", actorId, context);
    return;
  }
  await withdrawAlumniEntry(db, existingId, actorId, context);
  await approveAlumniEntry(db, id, actorId, {}, context);
}

/** Approves every id with no possible-duplicate flag; ids with a flag are left PENDING for individual review. */
export async function bulkApprove(
  db: Db,
  ids: string[],
  actorId: string,
  context?: AuditRequestContext,
): Promise<{ approved: string[]; skipped: string[] }> {
  const approved: string[] = [];
  const skipped: string[] = [];

  for (const id of ids) {
    const entry = await db.alumniEntry.findUniqueOrThrow({ where: { id } });
    const duplicates = await findPossibleDuplicates(db, entry.dedupeKey, entry.id);
    if (duplicates.length > 0) {
      skipped.push(id);
      continue;
    }
    await approveAlumniEntry(db, id, actorId, {}, context);
    approved.push(id);
  }

  return { approved, skipped };
}

/**
 * Admin edit is held to the same validation as the public submission form.
 * Programmes are replaced wholesale; pass the full list.
 */
export async function updateAlumniEntry(
  db: Db,
  id: string,
  fields: Partial<AlumniEntrySubmission>,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AlumniEntry> {
  const existing = await db.alumniEntry.findUniqueOrThrow({
    where: { id },
    include: { programmes: true },
  });

  const parsed = alumniEditableFieldsSchema.parse({
    fullName: fields.fullName ?? existing.fullName,
    email: fields.email ?? existing.email,
    programmes: fields.programmes ?? existing.programmes.map((p) => ({
      level: p.level,
      entryYear: p.entryYear ?? undefined,
      graduationYear: p.graduationYear,
    })),
    organisation: fields.organisation ?? existing.organisation ?? "",
    roleOrField: fields.roleOrField ?? existing.roleOrField ?? "",
    city: fields.city ?? existing.city ?? "",
    country: fields.country ?? existing.country ?? "",
    note: fields.note ?? existing.note ?? "",
    industry: fields.industry ?? existing.industry ?? "",
    linkedinUrl: fields.linkedinUrl ?? existing.linkedinUrl ?? "",
  });

  const updated = await db.alumniEntry.update({
    where: { id },
    data: {
      fullName: parsed.fullName,
      email: parsed.email,
      organisation: parsed.organisation || null,
      roleOrField: parsed.roleOrField || null,
      city: parsed.city || null,
      country: parsed.country || null,
      note: parsed.note || null,
      industry: parsed.industry || null,
      linkedinUrl: parsed.linkedinUrl || null,
      dedupeKey: computeDedupeKey(parsed.fullName, parsed.programmes[0]?.graduationYear ?? 0),
    },
  });

  if (fields.programmes) {
    await db.alumniProgramme.deleteMany({ where: { alumnusId: id } });
    await db.alumniProgramme.createMany({
      data: parsed.programmes.map((p) => ({
        alumnusId: id,
        level: p.level,
        entryYear: p.entryYear ?? null,
        graduationYear: p.graduationYear,
      })),
    });
  }

  await logAction(
    db,
    { actorId, action: "alumni_entry.update", entityType: "AlumniEntry", entityId: id, summary: "Edited alumni entry" },
    context,
  );

  return updated;
}

export async function setFeatured(
  db: Db,
  id: string,
  isFeatured: boolean,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AlumniEntry> {
  const updated = await db.alumniEntry.update({ where: { id }, data: { isFeatured } });

  await logAction(
    db,
    {
      actorId,
      action: isFeatured ? "alumni_entry.feature" : "alumni_entry.unfeature",
      entityType: "AlumniEntry",
      entityId: id,
      summary: isFeatured ? "Featured alumni entry" : "Unfeatured alumni entry",
    },
    context,
  );

  return updated;
}
