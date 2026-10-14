"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { createCalendarEntry, updateCalendarEntry, deleteCalendarEntry } from "@/server/services/academic-calendar";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireStudentsManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "students.manage");
}

function revalidateCalendarPaths() {
  revalidatePath("/admin/calendar");
  revalidatePath("/students/calendar");
  revalidatePath("/students/calendar/feed.ics");
  revalidatePath("/students");
}

function parseForm(formData: FormData) {
  return {
    session: String(formData.get("session") ?? ""),
    title: String(formData.get("title") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: formData.get("endDate") ? String(formData.get("endDate")) : null,
    description: String(formData.get("description") ?? ""),
  };
}

export async function createCalendarEntryAction(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  try {
    const created = await createCalendarEntry(db, parseForm(formData), actor.id, contextFromHeaders(await headers()));
    revalidateCalendarPaths();
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateCalendarEntryAction(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  try {
    const updated = await updateCalendarEntry(db, id, parseForm(formData), actor.id, contextFromHeaders(await headers()));
    revalidateCalendarPaths();
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function deleteCalendarEntryAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  try {
    await deleteCalendarEntry(db, id, actor.id, contextFromHeaders(await headers()));
    revalidateCalendarPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete" };
  }
}
