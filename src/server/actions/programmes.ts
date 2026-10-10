"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { getSetting, setSetting } from "@/server/services/site-settings";
import { listRevisions, getRevision } from "@/server/services/revisions";
import {
  updateProgramme,
  createSpecialisation,
  updateSpecialisation,
  setSpecialisationActive,
  reorderSpecialisation,
  getProgrammeById,
} from "@/server/services/programmes";
import { enumToLevelSlug } from "@/lib/programme-level";

type ActionResult = { error?: string; success?: boolean };

async function requireSiteEdit() {
  const user = await getCurrentUser();
  return requirePermission(user, "site.edit");
}

function revalidateProgrammePaths(levelSlug: string) {
  revalidatePath("/programmes");
  revalidatePath(`/programmes/${levelSlug}`);
  revalidatePath("/");
}

const programmeSaveSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  body: z.string(),
  duration: z.string().min(1),
  admissionRequirements: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function saveProgrammeAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSiteEdit();
  const parsed = programmeSaveSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    duration: formData.get("duration"),
    admissionRequirements: formData.get("admissionRequirements"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { id, ...data } = parsed.data;
    const updated = await updateProgramme(
      db,
      id,
      { ...data, body: sanitizeRichText(data.body), admissionRequirements: sanitizeRichText(data.admissionRequirements) },
      actor.id,
      contextFromHeaders(await headers()),
    );

    const flags = await getSetting(db, "programmes.importFlags");
    if (flags[updated.slug]) {
      const { [updated.slug]: _removed, ...rest } = flags;
      await setSetting(db, "programmes.importFlags", rest, actor.id);
    }

    revalidatePath("/admin/programmes");
    revalidatePath(`/admin/programmes/${enumToLevelSlug(updated.level)}`);
    revalidateProgrammePaths(enumToLevelSlug(updated.level));
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function listProgrammeRevisionsAction(id: string) {
  await requireSiteEdit();
  const revisions = await listRevisions(db, "Programme", id);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreProgrammeAction(formData: FormData): Promise<void> {
  const actor = await requireSiteEdit();
  const id = String(formData.get("id") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");

  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "Programme" || revision.entityId !== id) {
    throw new Error("Revision does not belong to this programme");
  }

  const updated = await updateProgramme(db, id, revision.snapshot, actor.id, contextFromHeaders(await headers()));
  revalidatePath("/admin/programmes");
  revalidatePath(`/admin/programmes/${enumToLevelSlug(updated.level)}`);
  revalidateProgrammePaths(enumToLevelSlug(updated.level));
}

const specialisationSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
});

export async function createSpecialisationAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireSiteEdit();
  const programmeId = String(formData.get("programmeId") ?? "");
  const parsed = specialisationSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createSpecialisation(db, programmeId, parsed.data, actor.id, contextFromHeaders(await headers()));
    const programme = await getProgrammeById(db, programmeId);
    revalidatePath(`/admin/programmes/${enumToLevelSlug(programme.level)}`);
    revalidateProgrammePaths(enumToLevelSlug(programme.level));
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateSpecialisationAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireSiteEdit();
  const id = String(formData.get("id") ?? "");
  const parsed = specialisationSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await updateSpecialisation(db, id, parsed.data, actor.id, contextFromHeaders(await headers()));
    const programme = await getProgrammeById(db, updated.programmeId);
    revalidatePath(`/admin/programmes/${enumToLevelSlug(programme.level)}`);
    revalidateProgrammePaths(enumToLevelSlug(programme.level));
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setSpecialisationActiveAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireSiteEdit();
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  try {
    const updated = await setSpecialisationActive(db, id, isActive, actor.id, contextFromHeaders(await headers()));
    const programme = await getProgrammeById(db, updated.programmeId);
    revalidatePath(`/admin/programmes/${enumToLevelSlug(programme.level)}`);
    revalidateProgrammePaths(enumToLevelSlug(programme.level));
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function reorderSpecialisationAction(formData: FormData): Promise<ActionResult> {
  await requireSiteEdit();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";

  try {
    await reorderSpecialisation(db, id, direction);
    const spec = await db.specialisation.findUniqueOrThrow({ where: { id }, include: { programme: true } });
    revalidatePath(`/admin/programmes/${enumToLevelSlug(spec.programme.level)}`);
    revalidateProgrammePaths(enumToLevelSlug(spec.programme.level));
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not reorder" };
  }
}
