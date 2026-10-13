"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import {
  registerDownload,
  updateDownloadMetadata,
  replaceDownloadFile,
  setDownloadStatus,
  reorderDownload,
} from "@/server/services/downloads";
import type { AdminDownloadCategory } from "@/lib/validators/download";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireStudentsManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "students.manage");
}

function revalidateDownloadPaths() {
  revalidatePath("/admin/downloads");
  revalidatePath("/students/downloads");
  revalidatePath("/students");
}

export async function registerDownloadAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  try {
    const created = await registerDownload(
      db,
      {
        publicId: String(formData.get("publicId") ?? ""),
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? "OTHER") as AdminDownloadCategory,
        status: String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        actorId: actor.id,
      },
      contextFromHeaders(await headers()),
    );
    revalidateDownloadPaths();
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not upload" };
  }
}

export async function updateDownloadMetadataAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  try {
    await updateDownloadMetadata(
      db,
      id,
      {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? "OTHER"),
        status: String(formData.get("status") ?? "DRAFT"),
      },
      actor.id,
      contextFromHeaders(await headers()),
    );
    revalidateDownloadPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function replaceDownloadFileAction(formData: FormData): Promise<ActionResult> {
  await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const publicId = String(formData.get("publicId") ?? "");
  try {
    await replaceDownloadFile(db, id, publicId);
    revalidateDownloadPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not replace file" };
  }
}

export async function setDownloadStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    return { error: "Invalid status" };
  }
  try {
    await setDownloadStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidateDownloadPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function reorderDownloadAction(formData: FormData): Promise<void> {
  await requireStudentsManage();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";
  await reorderDownload(db, id, direction);
  revalidateDownloadPaths();
}
