import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { cloudinary } from "@/lib/cloudinary";
import { logAction, type AuditRequestContext } from "./audit";

type Db = PrismaClient | Prisma.TransactionClient;

export const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB

function cvFolderFor(profileId: string): string {
  return `oau-maths/lecturers/cv/${profileId}`;
}

function surnameFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const surname = parts[parts.length - 1] || "Lecturer";
  return surname.replace(/[^a-zA-Z0-9-]/g, "");
}

/**
 * Registers an already-uploaded CV. The caller's own LecturerProfile is
 * looked up by userId (never taken from the client), and the publicId is
 * required to live under that exact profile's own CV folder - this is
 * the ownership check: a lecturer physically cannot register a publicId
 * under another profile's folder path, since that string itself names
 * the owning profile. See docs/MEDIA.md for the Cloudinary PDF research
 * behind every check here.
 */
export async function registerLecturerCv(
  db: Db,
  callerUserId: string,
  params: { publicId: string; actorId: string },
  context?: AuditRequestContext,
) {
  const profile = await db.lecturerProfile.findUniqueOrThrow({ where: { userId: callerUserId } });

  const folderPrefix = `${cvFolderFor(profile.id)}/`;
  if (!params.publicId.startsWith(folderPrefix)) {
    throw new Error(`publicId must be inside this lecturer's own CV folder (${folderPrefix})`);
  }

  const resource = await cloudinary.api.resource(params.publicId, { resource_type: "image" });

  if (resource.format !== "pdf") {
    await cloudinary.api.delete_resources([params.publicId], { resource_type: "image" });
    throw new Error(`The uploaded file is not a PDF (Cloudinary reports format "${resource.format}")`);
  }

  if (resource.bytes > MAX_CV_BYTES) {
    await cloudinary.api.delete_resources([params.publicId], { resource_type: "image" });
    throw new Error(`The CV is too large (${Math.round(resource.bytes / 1024 / 1024)}MB); the maximum is 5MB`);
  }

  // Confirm the delivery URL is actually reachable - Cloudinary blocks
  // public PDF/ZIP delivery by default on a free account (see MEDIA.md).
  let deliveryCheck: { ok: boolean; status: number };
  try {
    deliveryCheck = await fetch(resource.secure_url, { method: "HEAD" });
  } catch {
    deliveryCheck = { ok: false, status: 0 };
  }
  if (!deliveryCheck.ok && deliveryCheck.status === 401) {
    await cloudinary.api.delete_resources([params.publicId], { resource_type: "image" });
    throw new Error(
      'Cloudinary is blocking public delivery of this PDF. In the Cloudinary console, go to Settings > Security > "PDF and ZIP files delivery" and check "Allow delivery of PDF and ZIP files", then save.',
    );
  }

  const filename = `${surnameFrom(profile.fullName)}-CV.pdf`;

  return db.$transaction(async (tx) => {
    const previousCvDownloadId = profile.cvDownloadId;

    const download = await tx.download.create({
      data: {
        title: filename,
        category: "CV",
        filePublicId: params.publicId,
        fileUrl: resource.secure_url,
        fileSize: resource.bytes,
        status: "PUBLISHED",
      },
    });

    await tx.lecturerProfile.update({ where: { id: profile.id }, data: { cvDownloadId: download.id } });

    if (previousCvDownloadId) {
      const stillUsed = await tx.lecturerProfile.count({ where: { cvDownloadId: previousCvDownloadId } });
      if (stillUsed === 0) {
        const previous = await tx.download.findUnique({ where: { id: previousCvDownloadId } });
        if (previous?.filePublicId) {
          try {
            await cloudinary.api.delete_resources([previous.filePublicId], { resource_type: "image" });
          } catch {
            // best-effort cleanup; the Download row removal below still proceeds
          }
        }
        await tx.download.delete({ where: { id: previousCvDownloadId } });
      }
    }

    await logAction(
      tx,
      { actorId: params.actorId, action: "lecturer.cv_upload", entityType: "LecturerProfile", entityId: profile.id, summary: `Uploaded CV (${filename})` },
      context,
    );

    return { filename, downloadId: download.id, url: resource.secure_url };
  });
}
