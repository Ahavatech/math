"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { listRevisions, getRevision } from "@/server/services/revisions";
import { createCourse, updateCourse, setCourseStatus, commitCourseImport } from "@/server/services/courses";
import { validateCourseImportCsv, type CourseImportValidationResult } from "@/lib/course-import";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireStudentsManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "students.manage");
}

function revalidateCoursePaths(slug?: string) {
  revalidatePath("/admin/courses");
  revalidatePath("/students/courses");
  revalidatePath("/students");
  revalidatePath("/programmes/[level]", "page");
  revalidatePath("/lecturer/[slug]", "page");
  if (slug) revalidatePath(`/students/courses/${slug}`);
}

function parseForm(formData: FormData) {
  return {
    code: String(formData.get("code") ?? ""),
    title: String(formData.get("title") ?? ""),
    units: Number(formData.get("units")),
    level: Number(formData.get("level")),
    semester: String(formData.get("semester") ?? "FIRST"),
    programmeLevel: String(formData.get("programmeLevel") ?? "BSC"),
    isElective: formData.get("isElective") === "true",
    description: sanitizeRichText(String(formData.get("description") ?? "")),
    status: String(formData.get("status") ?? "DRAFT"),
    prerequisiteIds: formData.getAll("prerequisiteIds").map(String),
    lecturerIds: formData.getAll("lecturerIds").map(String),
  };
}

export async function createCourseAction(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  try {
    const created = await createCourse(db, parseForm(formData), actor.id, contextFromHeaders(await headers()));
    revalidateCoursePaths(created.slug);
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateCourseAction(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  try {
    const updated = await updateCourse(db, id, parseForm(formData), actor.id, contextFromHeaders(await headers()));
    revalidateCoursePaths(updated.slug);
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setCourseStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    return { error: "Invalid status" };
  }
  try {
    const updated = await setCourseStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidateCoursePaths(updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function listCourseRevisionsAction(id: string) {
  await requireStudentsManage();
  const revisions = await listRevisions(db, "Course", id);
  return revisions.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), createdByName: r.createdBy?.name ?? "Unknown" }));
}

export async function restoreCourseAction(formData: FormData): Promise<void> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");
  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "Course" || revision.entityId !== id) {
    throw new Error("Revision does not belong to this course");
  }
  const updated = await updateCourse(db, id, revision.snapshot as never, actor.id, contextFromHeaders(await headers()));
  revalidateCoursePaths(updated.slug);
}

export async function dryRunCourseImportAction(csvText: string): Promise<CourseImportValidationResult> {
  await requireStudentsManage();
  return validateCourseImportCsv(csvText, {
    codeExists: async (code) => (await db.course.findUnique({ where: { code } })) !== null,
  });
}

export async function commitCourseImportAction(validRows: CourseImportValidationResult["validRows"]): Promise<{ created: number }> {
  const actor = await requireStudentsManage();
  const result = await commitCourseImport(db, validRows, actor.id, contextFromHeaders(await headers()));
  revalidateCoursePaths();
  return result;
}
