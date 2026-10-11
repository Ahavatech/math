import "server-only";
import type { PrismaClient, Role, UserTokenType } from "@prisma/client";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";
import { issueToken } from "./tokens";
import { sendInviteEmail } from "@/lib/email";
import { generateUniqueSlug } from "@/lib/slugify";
import {
  lecturerSelfEditSchema,
  lecturerAdminEditSchema,
  publicationSchema,
  type LecturerSelfEditInput,
  type LecturerAdminEditInput,
  type PublicationInput,
} from "@/lib/validators/lecturer";

export class OwnershipError extends Error {
  constructor(message = "You do not own this resource") {
    super(message);
    this.name = "OwnershipError";
  }
}

export class IncompleteProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncompleteProfileError";
  }
}

// --- Admin: create -------------------------------------------------------

export async function createLecturer(
  db: PrismaClient,
  actorId: string,
  params: { fullName: string; honorific: string; rank: string; email: string },
  context?: AuditRequestContext,
) {
  const slug = await generateUniqueSlug(params.fullName, async (candidate) => {
    const existing = await db.lecturerProfile.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  return db.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: params.email },
      create: { email: params.email, name: params.fullName, isActive: true },
      update: {},
    });

    // Additive: a person who already holds another role (e.g. HOD) keeps
    // it, LECTURER is added alongside - never replace their role set.
    await tx.userRole.upsert({
      where: { userId_role: { userId: user.id, role: "LECTURER" as Role } },
      create: { userId: user.id, role: "LECTURER" },
      update: {},
    });

    const profile = await tx.lecturerProfile.create({
      data: {
        userId: user.id,
        slug,
        fullName: params.fullName,
        honorific: params.honorific || null,
        rank: params.rank as never,
        status: "DRAFT",
      },
    });

    await logAction(
      tx,
      {
        actorId,
        action: "lecturer.create",
        entityType: "LecturerProfile",
        entityId: profile.id,
        summary: `Created lecturer profile for ${params.fullName}`,
      },
      context,
    );

    return { user, profile };
  });
}

// --- Admin: list -----------------------------------------------------------

export async function listLecturersAdmin(db: PrismaClient) {
  const profiles = await db.lecturerProfile.findMany({
    include: { user: { select: { id: true, email: true, isActive: true, passwordHash: true } }, photo: true },
    orderBy: { createdAt: "desc" },
  });

  const userIds = profiles.map((p) => p.userId);
  const tokens = await db.userToken.findMany({
    where: { userId: { in: userIds }, type: "INVITE" },
    orderBy: { createdAt: "desc" },
  });
  const latestTokenByUser = new Map<string, (typeof tokens)[number]>();
  for (const token of tokens) {
    if (!latestTokenByUser.has(token.userId)) latestTokenByUser.set(token.userId, token);
  }

  return profiles.map((profile) => {
    const { passwordHash, ...safeUser } = profile.user;
    return {
      ...profile,
      user: safeUser,
      inviteState: deriveInviteState(passwordHash, latestTokenByUser.get(profile.userId) ?? null),
      completeness: computeCompleteness({
        photoId: profile.photoId,
        bio: profile.bio,
        researchAreaCount: 0, // filled in by the caller if needed; avoided here to keep this query cheap
      }),
    };
  });
}

export type InviteState = "not_invited" | "invited" | "accepted" | "expired";

export function deriveInviteState(
  passwordHash: string | null,
  latestInviteToken: { usedAt: Date | null; expiresAt: Date } | null,
): InviteState {
  if (passwordHash) return "accepted";
  if (!latestInviteToken) return "not_invited";
  if (latestInviteToken.usedAt) return "accepted";
  if (latestInviteToken.expiresAt.getTime() < Date.now()) return "expired";
  return "invited";
}

export function computeCompleteness(profile: { photoId: string | null; bio: string | null; researchAreaCount: number }): number {
  const checks = [profile.photoId !== null, Boolean(profile.bio && profile.bio.trim()), profile.researchAreaCount > 0];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

// --- Admin: field edits, status, slug --------------------------------------

export async function getLecturerById(db: PrismaClient, id: string) {
  return db.lecturerProfile.findUniqueOrThrow({
    where: { id },
    include: { user: { select: { id: true, email: true, isActive: true } }, photo: true, researchAreas: true, publications: { orderBy: { order: "asc" } } },
  });
}

export async function updateLecturerAdminFields(
  db: PrismaClient,
  actorId: string,
  id: string,
  input: unknown,
  context?: AuditRequestContext,
) {
  const parsed: LecturerAdminEditInput = lecturerAdminEditSchema.parse(input);
  const current = await db.lecturerProfile.findUniqueOrThrow({ where: { id } });

  const slugChanged = parsed.slug !== current.slug;
  const previousSlugs = slugChanged
    ? Array.from(new Set([...current.previousSlugs, current.slug]))
    : current.previousSlugs;

  return db.$transaction(async (tx) => {
    const updated = await tx.lecturerProfile.update({
      where: { id },
      data: { ...parsed, previousSlugs },
    });
    await createRevision(tx, { entityType: "LecturerProfile", entityId: id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "lecturer.admin_edit", entityType: "LecturerProfile", entityId: id, summary: `Updated admin fields for ${updated.fullName}` },
      context,
    );
    return updated;
  });
}

async function setLecturerStatus(
  db: PrismaClient,
  actorId: string,
  id: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
  context?: AuditRequestContext,
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.lecturerProfile.update({
      where: { id },
      data: { status, publishRequestedAt: status === "PUBLISHED" ? null : undefined },
    });
    await logAction(
      tx,
      { actorId, action: `lecturer.${status.toLowerCase()}`, entityType: "LecturerProfile", entityId: id, summary: `Set ${updated.fullName} to ${status}` },
      context,
    );
    return updated;
  });
}

export const publishLecturer = (db: PrismaClient, actorId: string, id: string, context?: AuditRequestContext) =>
  setLecturerStatus(db, actorId, id, "PUBLISHED", context);
export const unpublishLecturer = (db: PrismaClient, actorId: string, id: string, context?: AuditRequestContext) =>
  setLecturerStatus(db, actorId, id, "DRAFT", context);
export const archiveLecturer = (db: PrismaClient, actorId: string, id: string, context?: AuditRequestContext) =>
  setLecturerStatus(db, actorId, id, "ARCHIVED", context);
export const restoreLecturer = (db: PrismaClient, actorId: string, id: string, context?: AuditRequestContext) =>
  setLecturerStatus(db, actorId, id, "DRAFT", context);

export async function setLecturerAccountActive(
  db: PrismaClient,
  actorId: string,
  userId: string,
  isActive: boolean,
  context?: AuditRequestContext,
) {
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive } });
    await logAction(
      tx,
      { actorId, action: isActive ? "lecturer.reactivate" : "lecturer.deactivate", entityType: "User", entityId: userId, summary: isActive ? "Reactivated lecturer account" : "Deactivated lecturer account" },
      context,
    );
  });
}

export type InviteTokenType = UserTokenType;

/**
 * Issues a fresh invite token and emails it (also used for "resend
 * invite"). Returns the plaintext token/URL once so the admin UI can
 * also offer "copy invite link" - callers must not persist it anywhere
 * beyond that single response, since only its hash is ever stored.
 */
export async function sendLecturerInvite(
  db: PrismaClient,
  actorId: string,
  userId: string,
  context?: AuditRequestContext,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const { token } = await issueToken(db, userId, "INVITE");

  try {
    await sendInviteEmail({ to: user.email, name: user.name, token });
  } catch (error) {
    console.error(`Failed to send lecturer invite email for user ${userId}:`, error);
  }

  await logAction(
    db,
    { actorId, action: "lecturer.send_invite", entityType: "User", entityId: userId, summary: `Sent invite to ${user.email}` },
    context,
  );

  return { token };
}

// --- Self-service ------------------------------------------------------

export async function getLecturerByUserId(db: PrismaClient, userId: string) {
  return db.lecturerProfile.findUnique({
    where: { userId },
    include: { photo: true, researchAreas: true, publications: { orderBy: { order: "asc" } }, cvDownload: true },
  });
}

export async function updateOwnLecturerProfile(
  db: PrismaClient,
  callerUserId: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed: LecturerSelfEditInput = lecturerSelfEditSchema.parse(input);
  const profile = await db.lecturerProfile.findUniqueOrThrow({ where: { userId: callerUserId } });

  return db.$transaction(async (tx) => {
    const updated = await tx.lecturerProfile.update({
      where: { id: profile.id },
      data: {
        photoId: parsed.photoId,
        honorific: parsed.honorific || null,
        bio: parsed.bio || null,
        officeLocation: parsed.officeLocation || null,
        officeHours: parsed.officeHours || null,
        publicEmail: parsed.publicEmail || null,
        phone: parsed.phone || null,
        scholarUrl: parsed.scholarUrl || null,
        orcid: parsed.orcid || null,
        researchGateUrl: parsed.researchGateUrl || null,
        linkedinUrl: parsed.linkedinUrl || null,
        supervisionText: parsed.supervisionText || null,
        researchAreas: { set: parsed.researchAreaIds.map((id) => ({ id })) },
      },
    });
    await createRevision(tx, { entityType: "LecturerProfile", entityId: profile.id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "lecturer.self_edit", entityType: "LecturerProfile", entityId: profile.id, summary: `${updated.fullName} updated their profile` },
      context,
    );
    return updated;
  });
}

/** Admin "edit on behalf of the lecturer" - same field allowlist as the self-edit, but keyed
 * by profile id and requiring the caller to already hold lecturers.manage (checked by the
 * action layer, not here), with a distinct audit action name so the two are never confused. */
export async function adminUpdateLecturerSelfFields(
  db: PrismaClient,
  actorId: string,
  profileId: string,
  input: unknown,
  context?: AuditRequestContext,
) {
  const parsed: LecturerSelfEditInput = lecturerSelfEditSchema.parse(input);

  return db.$transaction(async (tx) => {
    const updated = await tx.lecturerProfile.update({
      where: { id: profileId },
      data: {
        photoId: parsed.photoId,
        honorific: parsed.honorific || null,
        bio: parsed.bio || null,
        officeLocation: parsed.officeLocation || null,
        officeHours: parsed.officeHours || null,
        publicEmail: parsed.publicEmail || null,
        phone: parsed.phone || null,
        scholarUrl: parsed.scholarUrl || null,
        orcid: parsed.orcid || null,
        researchGateUrl: parsed.researchGateUrl || null,
        linkedinUrl: parsed.linkedinUrl || null,
        supervisionText: parsed.supervisionText || null,
        researchAreas: { set: parsed.researchAreaIds.map((id) => ({ id })) },
      },
    });
    await createRevision(tx, { entityType: "LecturerProfile", entityId: profileId, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "lecturer.admin_edit_on_behalf", entityType: "LecturerProfile", entityId: profileId, summary: `Admin edited ${updated.fullName}'s profile on their behalf` },
      context,
    );
    return updated;
  });
}

export async function requestPublishing(db: PrismaClient, callerUserId: string, context?: AuditRequestContext) {
  const profile = await db.lecturerProfile.findUniqueOrThrow({
    where: { userId: callerUserId },
    include: { researchAreas: true },
  });

  const completeness = computeCompleteness({
    photoId: profile.photoId,
    bio: profile.bio,
    researchAreaCount: profile.researchAreas.length,
  });
  if (completeness < 100) {
    throw new IncompleteProfileError(
      "Your profile is not yet complete: a photo, a bio and at least one research area are required before you can request publishing.",
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.lecturerProfile.update({
      where: { id: profile.id },
      data: { publishRequestedAt: new Date() },
    });
    await logAction(
      tx,
      { actorId: callerUserId, action: "lecturer.request_publishing", entityType: "LecturerProfile", entityId: profile.id, summary: `${updated.fullName} requested publishing` },
      context,
    );
    return updated;
  });
}

// --- Publications (owner-scoped) -------------------------------------------

async function requireOwnedPublication(db: PrismaClient, publicationId: string, callerUserId: string) {
  const pub = await db.publication.findUniqueOrThrow({
    where: { id: publicationId },
    include: { lecturer: { select: { userId: true, id: true } } },
  });
  if (pub.lecturer.userId !== callerUserId) throw new OwnershipError("Not your publication");
  return pub;
}

export async function createPublicationForOwner(db: PrismaClient, callerUserId: string, input: unknown) {
  const parsed: PublicationInput = publicationSchema.parse(input);
  const profile = await db.lecturerProfile.findUniqueOrThrow({ where: { userId: callerUserId } });

  const existingCount = await db.publication.count({ where: { lecturerId: profile.id } });
  if (existingCount >= 200) {
    throw new Error("You have reached the 200 publication limit");
  }

  const max = await db.publication.aggregate({ where: { lecturerId: profile.id }, _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;

  return db.publication.create({
    data: {
      lecturerId: profile.id,
      title: parsed.title,
      authorsText: parsed.authorsText,
      venue: parsed.venue || null,
      year: parsed.year,
      url: parsed.url || null,
      doi: parsed.doi || null,
      order,
    },
  });
}

export async function updatePublicationForOwner(db: PrismaClient, callerUserId: string, publicationId: string, input: unknown) {
  await requireOwnedPublication(db, publicationId, callerUserId);
  const parsed: PublicationInput = publicationSchema.parse(input);
  return db.publication.update({
    where: { id: publicationId },
    data: {
      title: parsed.title,
      authorsText: parsed.authorsText,
      venue: parsed.venue || null,
      year: parsed.year,
      url: parsed.url || null,
      doi: parsed.doi || null,
    },
  });
}

export async function deletePublicationForOwner(db: PrismaClient, callerUserId: string, publicationId: string) {
  await requireOwnedPublication(db, publicationId, callerUserId);
  await db.publication.delete({ where: { id: publicationId } });
}

export async function reorderPublicationForOwner(
  db: PrismaClient,
  callerUserId: string,
  publicationId: string,
  direction: "up" | "down",
) {
  const target = await requireOwnedPublication(db, publicationId, callerUserId);
  const siblings = await db.publication.findMany({ where: { lecturerId: target.lecturerId }, orderBy: { order: "asc" } });

  const index = siblings.findIndex((s) => s.id === publicationId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.publication.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.publication.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}

// --- Public ----------------------------------------------------------------

/** Public-safe: PUBLISHED status, active account only; never selects User.email or passwordHash. */
export async function getPublishedLecturerBySlug(db: PrismaClient, slug: string) {
  try {
    const profile = await db.lecturerProfile.findUnique({
      where: { slug },
      include: {
        photo: true,
        researchAreas: { where: { status: "PUBLISHED" }, select: { id: true, slug: true, title: true } },
        publications: { orderBy: [{ year: "desc" }, { order: "asc" }] },
        cvDownload: true,
        user: { select: { isActive: true } },
      },
    });
    if (!profile || profile.status !== "PUBLISHED" || !profile.user.isActive) return null;
    return profile;
  } catch {
    return null;
  }
}

/** Looks up a slug regardless of status, for the previousSlugs redirect and the draft-preview 404 distinction. */
export async function findLecturerBySlugOrPreviousSlug(db: PrismaClient, slug: string) {
  try {
    const direct = await db.lecturerProfile.findUnique({ where: { slug }, select: { slug: true, status: true, userId: true } });
    if (direct) return { profile: direct, redirectTo: null as string | null };

    const viaPrevious = await db.lecturerProfile.findFirst({
      where: { previousSlugs: { has: slug } },
      select: { slug: true, status: true, userId: true },
    });
    if (viaPrevious) return { profile: viaPrevious, redirectTo: viaPrevious.slug };

    return null;
  } catch {
    return null;
  }
}
