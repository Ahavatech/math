import "server-only";
import type { MediaAsset, Prisma, PrismaClient } from "@prisma/client";
import { cloudinary } from "@/lib/cloudinary";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

const MEDIA_ROOT = "oau-maths/";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Creates the MediaAsset row for a file already uploaded to Cloudinary.
 * Deliberately takes no width/height/url/format/bytes from the caller:
 * those are re-fetched from Cloudinary here, server-side, by publicId,
 * so a tampered client request can never write fabricated dimensions
 * or an off-Cloudinary URL into the database.
 */
export async function registerMediaAsset(
  db: Db,
  params: { publicId: string; alt: string; uploadedById: string | null },
): Promise<MediaAsset> {
  if (!params.alt.trim()) {
    throw new Error("alt text is required");
  }
  if (!params.publicId.startsWith(MEDIA_ROOT)) {
    throw new Error(`publicId must be inside the ${MEDIA_ROOT} folder`);
  }

  const resource = await cloudinary.api.resource(params.publicId, {
    resource_type: "image",
  });

  return db.mediaAsset.create({
    data: {
      provider: "cloudinary",
      publicId: params.publicId,
      url: resource.secure_url,
      width: resource.width,
      height: resource.height,
      bytes: resource.bytes,
      format: resource.format,
      alt: params.alt,
      uploadedById: params.uploadedById,
    },
  });
}

export async function updateMediaAlt(
  db: PrismaClient,
  actorId: string,
  mediaId: string,
  alt: string,
  context?: AuditRequestContext,
): Promise<void> {
  if (!alt.trim()) {
    throw new Error("alt text is required");
  }

  await db.$transaction(async (tx) => {
    await tx.mediaAsset.update({ where: { id: mediaId }, data: { alt } });
    await logAction(
      tx,
      {
        actorId,
        action: "media.update_alt",
        entityType: "MediaAsset",
        entityId: mediaId,
        summary: "Updated alt text",
      },
      context,
    );
  });
}

/** Counts every row across every nullable MediaAsset relation that references this asset. */
export async function countMediaUsage(db: PrismaClient, mediaId: string): Promise<number> {
  const [
    researchAreas,
    lecturerPhotos,
    nonTeachingPhotos,
    newsCovers,
    eventFlyers,
    eventGallery,
    alumniPhotos,
    journalCovers,
    downloads,
  ] = await Promise.all([
    db.researchArea.count({ where: { imageId: mediaId } }),
    db.lecturerProfile.count({ where: { photoId: mediaId } }),
    db.nonTeachingStaff.count({ where: { photoId: mediaId } }),
    db.newsPost.count({ where: { coverId: mediaId } }),
    db.event.count({ where: { flyerId: mediaId } }),
    db.eventGalleryImage.count({ where: { mediaId } }),
    db.alumniEntry.count({ where: { photoId: mediaId } }),
    db.journalIssue.count({ where: { coverId: mediaId } }),
    db.download.count({ where: { mediaId } }),
  ]);

  return (
    researchAreas +
    lecturerPhotos +
    nonTeachingPhotos +
    newsCovers +
    eventFlyers +
    eventGallery +
    alumniPhotos +
    journalCovers +
    downloads
  );
}

export class MediaInUseError extends Error {
  constructor() {
    super("This media asset is still in use and cannot be deleted");
    this.name = "MediaInUseError";
  }
}

export async function deleteMediaAsset(
  db: PrismaClient,
  actorId: string,
  mediaId: string,
  context?: AuditRequestContext,
): Promise<void> {
  const usage = await countMediaUsage(db, mediaId);
  if (usage > 0) {
    throw new MediaInUseError();
  }

  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });

  await cloudinary.api.delete_resources([asset.publicId], { resource_type: "image" });

  await db.$transaction(async (tx) => {
    await tx.mediaAsset.delete({ where: { id: mediaId } });
    await logAction(
      tx,
      {
        actorId,
        action: "media.delete",
        entityType: "MediaAsset",
        entityId: mediaId,
        summary: "Deleted unused media asset",
      },
      context,
    );
  });
}

export async function listMediaAssets(db: PrismaClient) {
  return db.mediaAsset.findMany({ orderBy: { createdAt: "desc" } });
}
