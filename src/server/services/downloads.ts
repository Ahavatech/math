import "server-only";
import type { ContentStatus, Download, PrismaClient } from "@prisma/client";
import { cloudinary } from "@/lib/cloudinary";
import { downloadInputSchema, type AdminDownloadCategory } from "@/lib/validators/download";
import { logAction, type AuditRequestContext } from "./audit";

export const DOWNLOADS_FOLDER = "oau-maths/downloads";
export const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Registers a signed-uploaded PDF as a new Download. Follows the same
 * verification pattern as src/server/services/lecturer-cv.ts (format,
 * size, re-fetched from Cloudinary rather than trusted from the
 * client) but is not scoped to a single lecturer's own folder - any
 * `students.manage` admin can upload into the shared downloads folder.
 */
export async function registerDownload(
  db: PrismaClient,
  params: { publicId: string; title: string; description: string; category: AdminDownloadCategory; status: ContentStatus; actorId: string },
  context?: AuditRequestContext,
): Promise<Download> {
  const parsed = downloadInputSchema.parse({ title: params.title, description: params.description, category: params.category, status: params.status });

  const folderPrefix = `${DOWNLOADS_FOLDER}/`;
  if (!params.publicId.startsWith(folderPrefix)) {
    throw new Error(`publicId must be inside the ${folderPrefix} folder`);
  }

  const resource = await cloudinary.api.resource(params.publicId, { resource_type: "image" });

  if (resource.format !== "pdf") {
    await cloudinary.api.delete_resources([params.publicId], { resource_type: "image" });
    throw new Error(`The uploaded file is not a PDF (Cloudinary reports format "${resource.format}")`);
  }
  if (resource.bytes > MAX_DOWNLOAD_BYTES) {
    await cloudinary.api.delete_resources([params.publicId], { resource_type: "image" });
    throw new Error(`The file is too large (${Math.round(resource.bytes / 1024 / 1024)}MB); the maximum is 10MB`);
  }

  const max = await db.download.aggregate({ where: { category: parsed.category }, _max: { order: true } });

  return db.$transaction(async (tx) => {
    const created = await tx.download.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        category: parsed.category,
        status: parsed.status,
        filePublicId: params.publicId,
        fileUrl: resource.secure_url,
        fileSize: resource.bytes,
        order: (max._max.order ?? -1) + 1,
        uploadedById: params.actorId,
      },
    });
    await logAction(
      tx,
      { actorId: params.actorId, action: "download.create", entityType: "Download", entityId: created.id, summary: `Uploaded ${created.title}` },
      context,
    );
    return created;
  });
}

export async function updateDownloadMetadata(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
): Promise<Download> {
  const parsed = downloadInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const updated = await tx.download.update({ where: { id }, data: parsed });
    await logAction(
      tx,
      { actorId, action: "download.update", entityType: "Download", entityId: id, summary: `Updated ${updated.title}` },
      context,
    );
    return updated;
  });
}

/** Registers a replacement file for an existing Download row, then deletes the old Cloudinary asset. */
export async function replaceDownloadFile(db: PrismaClient, id: string, newPublicId: string): Promise<Download> {
  const existing = await db.download.findUniqueOrThrow({ where: { id } });
  const folderPrefix = `${DOWNLOADS_FOLDER}/`;
  if (!newPublicId.startsWith(folderPrefix)) {
    throw new Error(`publicId must be inside the ${folderPrefix} folder`);
  }

  const resource = await cloudinary.api.resource(newPublicId, { resource_type: "image" });
  if (resource.format !== "pdf") {
    await cloudinary.api.delete_resources([newPublicId], { resource_type: "image" });
    throw new Error(`The uploaded file is not a PDF (Cloudinary reports format "${resource.format}")`);
  }

  const updated = await db.download.update({
    where: { id },
    data: { filePublicId: newPublicId, fileUrl: resource.secure_url, fileSize: resource.bytes },
  });

  if (existing.filePublicId && existing.filePublicId !== newPublicId) {
    await cloudinary.api.delete_resources([existing.filePublicId], { resource_type: "image" });
  }

  return updated;
}

export async function setDownloadStatus(
  db: PrismaClient,
  id: string,
  status: ContentStatus,
  actorId: string,
  context?: AuditRequestContext,
): Promise<Download> {
  return db.$transaction(async (tx) => {
    const updated = await tx.download.update({ where: { id }, data: { status } });
    await logAction(
      tx,
      { actorId, action: "download.set_status", entityType: "Download", entityId: id, summary: `Set ${updated.title} to ${status}` },
      context,
    );
    return updated;
  });
}

/** Swaps `order` with the adjacent sibling in the same category. */
export async function reorderDownload(db: PrismaClient, id: string, direction: "up" | "down"): Promise<void> {
  const target = await db.download.findUniqueOrThrow({ where: { id } });
  const siblings = await db.download.findMany({ where: { category: target.category }, orderBy: { order: "asc" } });

  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.download.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.download.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}

/** Excludes CV - that category belongs to lecturers and is never listed here. */
export async function listDownloadsAdmin(db: PrismaClient) {
  return db.download.findMany({ where: { category: { not: "CV" } }, orderBy: [{ category: "asc" }, { order: "asc" }] });
}

export async function listDownloadsPublic(db: PrismaClient) {
  try {
    return await db.download.findMany({
      where: { status: "PUBLISHED", category: { not: "CV" } },
      select: { id: true, title: true, description: true, category: true, fileUrl: true, fileSize: true, order: true },
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });
  } catch {
    return [];
  }
}
