"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { isMediaFolder, permissionForFolder } from "@/lib/media-folders";
import {
  registerMediaAsset,
  updateMediaAlt,
  deleteMediaAsset,
  countMediaUsage,
  MediaInUseError,
} from "@/server/services/media";

type ActionResult = { error?: string; success?: boolean; mediaId?: string };

const registerSchema = z.object({
  publicId: z.string().min(1),
  alt: z.string().min(1, "Alt text is required"),
  folder: z.string().min(1),
});

export async function registerMediaAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = registerSchema.safeParse({
    publicId: formData.get("publicId"),
    alt: formData.get("alt"),
    folder: formData.get("folder"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isMediaFolder(parsed.data.folder)) {
    return { error: "Invalid folder" };
  }

  try {
    requirePermission(user, permissionForFolder(parsed.data.folder));
    const asset = await registerMediaAsset(db, {
      publicId: parsed.data.publicId,
      alt: parsed.data.alt,
      uploadedById: user.id,
      folder: parsed.data.folder,
    });
    revalidatePath("/admin/media");
    return { success: true, mediaId: asset.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not register upload" };
  }
}

export async function updateMediaAltAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "site.edit");
  const mediaId = String(formData.get("mediaId") ?? "");
  const alt = String(formData.get("alt") ?? "");

  try {
    await updateMediaAlt(db, actor.id, mediaId, alt, contextFromHeaders(await headers()));
    revalidatePath("/admin/media");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function deleteMediaAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "site.edit");
  const mediaId = String(formData.get("mediaId") ?? "");

  try {
    await deleteMediaAsset(db, actor.id, mediaId, contextFromHeaders(await headers()));
    revalidatePath("/admin/media");
    return { success: true };
  } catch (error) {
    if (error instanceof MediaInUseError) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : "Could not delete" };
  }
}

export async function getMediaUsageAction(mediaId: string): Promise<number> {
  await requirePermission(await getCurrentUser(), "site.edit");
  return countMediaUsage(db, mediaId);
}
