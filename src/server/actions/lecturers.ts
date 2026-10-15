"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { listRevisions, getRevision } from "@/server/services/revisions";
import { parseRank } from "@/lib/lecturer-rank";
import {
  createLecturer,
  updateLecturerAdminFields,
  publishLecturer,
  unpublishLecturer,
  archiveLecturer,
  restoreLecturer,
  setLecturerAccountActive,
  sendLecturerInvite,
  updateOwnLecturerProfile,
  adminUpdateLecturerSelfFields,
  requestPublishing,
  getLecturerByUserId,
  createPublicationForOwner,
  updatePublicationForOwner,
  deletePublicationForOwner,
  reorderPublicationForOwner,
  reorderLecturer,
  OwnershipError,
  IncompleteProfileError,
} from "@/server/services/lecturers";
import { validateLecturerImportCsv } from "@/lib/lecturer-import";
import { bulkCreateLecturers, bulkSendInvites } from "@/server/services/lecturer-import";
import { registerLecturerCv } from "@/server/services/lecturer-cv";
import { publicationSchema } from "@/lib/validators/lecturer";

type ActionResult = { error?: string; success?: boolean };

async function requireLecturersManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "lecturers.manage");
}

async function requireOwnLecturerProfile() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) throw new Error("Unauthorized");
  const profile = await getLecturerByUserId(db, user.id);
  if (!profile) throw new Error("You do not have a lecturer profile");
  return { user, profile };
}

/**
 * Revalidates every public route a lecturer change could affect: their
 * own page, the staff directory, the homepage (featured lecturer / stat),
 * and every research area page they are linked to (for the "Lecturers in
 * this area" / "Selected publications" blocks).
 */
async function revalidateLecturerPaths(lecturerId: string | undefined, slug?: string) {
  revalidatePath("/admin/lecturers");
  revalidatePath("/staff");
  revalidatePath("/");
  if (slug) revalidatePath(`/lecturer/${slug}`);
  if (lecturerId) {
    const areas = await db.researchArea.findMany({
      where: { lecturers: { some: { id: lecturerId } } },
      select: { slug: true },
    });
    for (const area of areas) revalidatePath(`/research/${area.slug}`);
  }
}

// --- Admin -------------------------------------------------------------

const createLecturerSchema = z.object({
  fullName: z.string().min(1),
  honorific: z.string().default(""),
  rank: z.string().min(1),
  email: z.string().email(),
});

export async function createLecturerAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireLecturersManage();
  const parsed = createLecturerSchema.safeParse({
    fullName: formData.get("fullName"),
    honorific: formData.get("honorific"),
    rank: formData.get("rank"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const rank = parseRank(parsed.data.rank) ?? parsed.data.rank; // admin form sends the enum value directly
  try {
    await createLecturer(
      db,
      actor.id,
      { ...parsed.data, rank },
      contextFromHeaders(await headers()),
    );
    revalidatePath("/admin/lecturers");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create lecturer" };
  }
}

export async function sendLecturerInviteAction(
  formData: FormData,
): Promise<ActionResult & { inviteUrl?: string }> {
  const actor = await requireLecturersManage();
  const userId = String(formData.get("userId") ?? "");
  try {
    const { token } = await sendLecturerInvite(db, actor.id, userId, contextFromHeaders(await headers()));
    revalidatePath("/admin/lecturers");
    const inviteUrl = new URL(`/accept-invite/${token}`, env.AUTH_URL).toString();
    return { success: true, inviteUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send invite" };
  }
}

const adminFieldsSchema = z.object({
  slug: z.string().min(1),
  rank: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  order: z.coerce.number().int(),
  isEmeritus: z.coerce.boolean(),
});

export async function updateLecturerAdminFieldsAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireLecturersManage();
  const id = String(formData.get("id") ?? "");
  const parsed = adminFieldsSchema.safeParse({
    slug: formData.get("slug"),
    rank: formData.get("rank"),
    status: formData.get("status"),
    order: formData.get("order") ?? 0,
    isEmeritus: formData.get("isEmeritus") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await updateLecturerAdminFields(db, actor.id, id, parsed.data, contextFromHeaders(await headers()));
    await revalidateLecturerPaths(updated.id, updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

async function withLecturerStatusAction(
  id: string,
  fn: typeof publishLecturer,
  actorId: string,
) {
  const context = contextFromHeaders(await headers());
  const updated = await fn(db, actorId, id, context);
  await revalidateLecturerPaths(updated.id, updated.slug);
}

export async function publishLecturerAction(formData: FormData): Promise<void> {
  const actor = await requireLecturersManage();
  await withLecturerStatusAction(String(formData.get("id") ?? ""), publishLecturer, actor.id);
}
export async function unpublishLecturerAction(formData: FormData): Promise<void> {
  const actor = await requireLecturersManage();
  await withLecturerStatusAction(String(formData.get("id") ?? ""), unpublishLecturer, actor.id);
}
export async function archiveLecturerAction(formData: FormData): Promise<void> {
  const actor = await requireLecturersManage();
  await withLecturerStatusAction(String(formData.get("id") ?? ""), archiveLecturer, actor.id);
}
export async function restoreLecturerAction(formData: FormData): Promise<void> {
  const actor = await requireLecturersManage();
  await withLecturerStatusAction(String(formData.get("id") ?? ""), restoreLecturer, actor.id);
}

export async function reorderLecturerAction(formData: FormData): Promise<void> {
  await requireLecturersManage();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";
  await reorderLecturer(db, id, direction);
  await revalidateLecturerPaths(id);
}

export async function setLecturerAccountActiveAction(formData: FormData): Promise<void> {
  const actor = await requireLecturersManage();
  const userId = String(formData.get("userId") ?? "");
  const isActive = formData.get("isActive") === "true";
  await setLecturerAccountActive(db, actor.id, userId, isActive, contextFromHeaders(await headers()));
  revalidatePath("/admin/lecturers");
}

export async function adminUpdateLecturerSelfFieldsAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireLecturersManage();
  const profileId = String(formData.get("profileId") ?? "");

  const parsed = selfEditFormSchema.safeParse({
    photoId: formData.get("photoId") || null,
    honorific: formData.get("honorific"),
    bio: formData.get("bio"),
    researchAreaIds: formData.getAll("researchAreaIds").map(String),
    officeLocation: formData.get("officeLocation"),
    officeHours: formData.get("officeHours"),
    publicEmail: formData.get("publicEmail"),
    phone: formData.get("phone"),
    scholarUrl: formData.get("scholarUrl"),
    orcid: formData.get("orcid"),
    researchGateUrl: formData.get("researchGateUrl"),
    linkedinUrl: formData.get("linkedinUrl"),
    supervisionText: formData.get("supervisionText"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await adminUpdateLecturerSelfFields(
      db,
      actor.id,
      profileId,
      {
        ...parsed.data,
        bio: sanitizeRichText(parsed.data.bio),
        supervisionText: sanitizeRichText(parsed.data.supervisionText),
      },
      contextFromHeaders(await headers()),
    );
    await revalidateLecturerPaths(updated.id, updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

// --- CSV bulk import -----------------------------------------------------

export type DryRunResult = Awaited<ReturnType<typeof validateLecturerImportCsv>>;

export async function dryRunLecturerImportAction(csvText: string): Promise<DryRunResult> {
  await requireLecturersManage();
  return validateLecturerImportCsv(csvText, {
    emailExists: async (email) => {
      const existing = await db.user.findUnique({ where: { email } });
      return existing !== null;
    },
  });
}

export async function bulkCreateLecturersAction(rows: DryRunResult["validRows"]) {
  const actor = await requireLecturersManage();
  const results = await bulkCreateLecturers(db, actor.id, rows, contextFromHeaders(await headers()));
  revalidatePath("/admin/lecturers");
  return results;
}

export async function bulkSendInvitesAction(userIds: string[]) {
  const actor = await requireLecturersManage();
  const results = await bulkSendInvites(db, actor.id, userIds, contextFromHeaders(await headers()));
  revalidatePath("/admin/lecturers");
  return results;
}

// --- Self-service --------------------------------------------------------

const selfEditFormSchema = z.object({
  photoId: z.string().nullable(),
  honorific: z.string().default(""),
  bio: z.string().default(""),
  researchAreaIds: z.array(z.string()).default([]),
  officeLocation: z.string().default(""),
  officeHours: z.string().default(""),
  publicEmail: z.string().default(""),
  phone: z.string().default(""),
  scholarUrl: z.string().default(""),
  orcid: z.string().default(""),
  researchGateUrl: z.string().default(""),
  linkedinUrl: z.string().default(""),
  supervisionText: z.string().default(""),
});

export async function updateOwnLecturerProfileAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireOwnLecturerProfile();

  const parsed = selfEditFormSchema.safeParse({
    photoId: formData.get("photoId") || null,
    honorific: formData.get("honorific"),
    bio: formData.get("bio"),
    researchAreaIds: formData.getAll("researchAreaIds").map(String),
    officeLocation: formData.get("officeLocation"),
    officeHours: formData.get("officeHours"),
    publicEmail: formData.get("publicEmail"),
    phone: formData.get("phone"),
    scholarUrl: formData.get("scholarUrl"),
    orcid: formData.get("orcid"),
    researchGateUrl: formData.get("researchGateUrl"),
    linkedinUrl: formData.get("linkedinUrl"),
    supervisionText: formData.get("supervisionText"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await updateOwnLecturerProfile(
      db,
      user.id,
      {
        ...parsed.data,
        bio: sanitizeRichText(parsed.data.bio),
        supervisionText: sanitizeRichText(parsed.data.supervisionText),
      },
      user.id,
      contextFromHeaders(await headers()),
    );
    await revalidateLecturerPaths(updated.id, updated.slug);
    revalidatePath("/admin/my-profile");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function requestPublishingAction(): Promise<ActionResult> {
  const { user } = await requireOwnLecturerProfile();
  try {
    await requestPublishing(db, user.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/my-profile");
    revalidatePath("/admin/lecturers");
    return { success: true };
  } catch (error) {
    if (error instanceof IncompleteProfileError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not request publishing" };
  }
}

export async function listOwnLecturerRevisionsAction() {
  const { profile } = await requireOwnLecturerProfile();
  const revisions = await listRevisions(db, "LecturerProfile", profile.id);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreOwnLecturerProfileAction(formData: FormData): Promise<void> {
  const { user, profile } = await requireOwnLecturerProfile();
  const revisionId = String(formData.get("revisionId") ?? "");

  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "LecturerProfile" || revision.entityId !== profile.id) {
    throw new Error("Revision does not belong to your profile");
  }

  await updateOwnLecturerProfile(db, user.id, revision.snapshot, user.id, contextFromHeaders(await headers()));
  await revalidateLecturerPaths(profile.id, profile.slug);
  revalidatePath("/admin/my-profile");
}

// --- Publications ----------------------------------------------------------

function publicationFormData(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    authorsText: String(formData.get("authorsText") ?? ""),
    venue: String(formData.get("venue") ?? ""),
    year: Number(formData.get("year") ?? 0),
    url: String(formData.get("url") ?? ""),
    doi: String(formData.get("doi") ?? ""),
  };
}

export async function createPublicationAction(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireOwnLecturerProfile();
  const parsed = publicationSchema.safeParse(publicationFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await createPublicationForOwner(db, user.id, parsed.data);
    await revalidateLecturerPaths(profile.id, profile.slug);
    revalidatePath("/admin/my-profile");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add publication" };
  }
}

export async function updatePublicationAction(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireOwnLecturerProfile();
  const id = String(formData.get("id") ?? "");
  const parsed = publicationSchema.safeParse(publicationFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await updatePublicationForOwner(db, user.id, id, parsed.data);
    await revalidateLecturerPaths(profile.id, profile.slug);
    revalidatePath("/admin/my-profile");
    return { success: true };
  } catch (error) {
    if (error instanceof OwnershipError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function deletePublicationAction(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireOwnLecturerProfile();
  const id = String(formData.get("id") ?? "");
  try {
    await deletePublicationForOwner(db, user.id, id);
    await revalidateLecturerPaths(profile.id, profile.slug);
    revalidatePath("/admin/my-profile");
    return { success: true };
  } catch (error) {
    if (error instanceof OwnershipError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not delete" };
  }
}

export async function reorderPublicationAction(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireOwnLecturerProfile();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";
  try {
    await reorderPublicationForOwner(db, user.id, id, direction);
    await revalidateLecturerPaths(profile.id, profile.slug);
    return { success: true };
  } catch (error) {
    if (error instanceof OwnershipError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not reorder" };
  }
}

// --- CV ----------------------------------------------------------------

export async function registerLecturerCvAction(formData: FormData): Promise<ActionResult> {
  const { user, profile } = await requireOwnLecturerProfile();
  const publicId = String(formData.get("publicId") ?? "");
  try {
    await registerLecturerCv(db, user.id, { publicId, actorId: user.id }, contextFromHeaders(await headers()));
    await revalidateLecturerPaths(profile.id, profile.slug);
    revalidatePath("/admin/my-profile");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not register CV" };
  }
}
