"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { listRevisions, getRevision } from "@/server/services/revisions";
import {
  createNonTeachingStaff,
  updateNonTeachingStaff,
  setNonTeachingStaffActive,
  reorderNonTeachingStaff,
} from "@/server/services/non-teaching-staff";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireLecturersManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "lecturers.manage");
}

function revalidateStaffPaths() {
  revalidatePath("/admin/staff");
  revalidatePath("/staff");
}

const nonTeachingStaffFormSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  photoId: z.string().nullable(),
  email: z.string().default(""),
  phone: z.string().default(""),
  showContact: z.boolean().default(false),
});

function parseForm(formData: FormData) {
  return nonTeachingStaffFormSchema.safeParse({
    name: formData.get("name"),
    position: formData.get("position"),
    photoId: formData.get("photoId") ? String(formData.get("photoId")) : null,
    email: formData.get("email"),
    phone: formData.get("phone"),
    showContact: formData.get("showContact") === "true",
  });
}

export async function createNonTeachingStaffAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireLecturersManage();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const created = await createNonTeachingStaff(db, parsed.data, actor.id, contextFromHeaders(await headers()));
    revalidateStaffPaths();
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateNonTeachingStaffAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireLecturersManage();
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await updateNonTeachingStaff(db, id, parsed.data, actor.id, contextFromHeaders(await headers()));
    revalidateStaffPaths();
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setNonTeachingStaffActiveAction(formData: FormData): Promise<void> {
  const actor = await requireLecturersManage();
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  await setNonTeachingStaffActive(db, id, isActive, actor.id, contextFromHeaders(await headers()));
  revalidateStaffPaths();
}

export async function reorderNonTeachingStaffAction(formData: FormData): Promise<void> {
  await requireLecturersManage();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";
  await reorderNonTeachingStaff(db, id, direction);
  revalidateStaffPaths();
}

export async function listNonTeachingStaffRevisionsAction(id: string) {
  await requireLecturersManage();
  const revisions = await listRevisions(db, "NonTeachingStaff", id);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreNonTeachingStaffAction(formData: FormData): Promise<void> {
  const actor = await requireLecturersManage();
  const id = String(formData.get("id") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");

  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "NonTeachingStaff" || revision.entityId !== id) {
    throw new Error("Revision does not belong to this record");
  }

  await updateNonTeachingStaff(db, id, revision.snapshot, actor.id, contextFromHeaders(await headers()));
  revalidateStaffPaths();
}
