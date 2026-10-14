"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import {
  deskReject,
  returnToAuthor,
  approveForReview,
  assignHandlingEditor,
  addInternalNote,
} from "@/server/services/manuscript-screening";
import { z } from "zod";

function sessionUser(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return { id: user.id, roles: user.roles, isActive: user.isActive ?? true };
}

export async function assignHandlingEditorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const manuscriptId = z.string().min(1).parse(formData.get("manuscriptId"));
  const editorId = z.string().min(1).parse(formData.get("editorId"));

  await assignHandlingEditor(prisma, sessionUser(user), manuscriptId, editorId);
  revalidatePath(`/admin/journal/manuscripts/${manuscriptId}`);
}

export async function deskRejectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const manuscriptId = z.string().min(1).parse(formData.get("manuscriptId"));
  const letter = z.string().min(1).parse(formData.get("letter"));

  await deskReject(prisma, sessionUser(user), manuscriptId, letter);
  revalidatePath(`/admin/journal/manuscripts/${manuscriptId}`);
  revalidatePath("/admin/journal/manuscripts");
}

export async function returnToAuthorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const manuscriptId = z.string().min(1).parse(formData.get("manuscriptId"));
  const message = z.string().min(1).parse(formData.get("message"));

  await returnToAuthor(prisma, sessionUser(user), manuscriptId, message);
  revalidatePath(`/admin/journal/manuscripts/${manuscriptId}`);
}

export async function approveForReviewAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const manuscriptId = z.string().min(1).parse(formData.get("manuscriptId"));

  await approveForReview(prisma, sessionUser(user), manuscriptId);
  revalidatePath(`/admin/journal/manuscripts/${manuscriptId}`);
  revalidatePath("/admin/journal/manuscripts");
}

export async function addInternalNoteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const manuscriptId = z.string().min(1).parse(formData.get("manuscriptId"));
  const note = z.string().min(1).parse(formData.get("note"));

  await addInternalNote(prisma, sessionUser(user), manuscriptId, note);
  revalidatePath(`/admin/journal/manuscripts/${manuscriptId}`);
}
