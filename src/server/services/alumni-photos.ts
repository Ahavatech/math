import "server-only";
import type { MediaAsset, Prisma, PrismaClient } from "@prisma/client";
import { cloudinary, ALLOWED_IMAGE_FORMATS } from "@/lib/cloudinary";

type Db = PrismaClient | Prisma.TransactionClient;

export const ALUMNI_PENDING_FOLDER = "oau-maths/alumni/pending";

/**
 * Registers a MediaAsset for a photo already uploaded to Cloudinary as
 * `type: authenticated` under the pending-alumni folder. Re-verifies
 * everything server-side from Cloudinary's own API response - folder,
 * format and the actual delivery type - never trusting what the
 * client claims. See docs/MEDIA.md's "Alumni photo lifecycle" section
 * for why `authenticated` is required here (DECISIONS.md #33/#34).
 */
export async function registerPendingAlumniPhoto(
  db: Db,
  params: { publicId: string },
): Promise<MediaAsset> {
  const folderPrefix = `${ALUMNI_PENDING_FOLDER}/`;
  if (!params.publicId.startsWith(folderPrefix)) {
    throw new Error(`publicId must be inside the ${folderPrefix} folder`);
  }

  const resource = await cloudinary.api.resource(params.publicId, {
    resource_type: "image",
    type: "authenticated",
  });

  if (resource.type !== "authenticated") {
    throw new Error("Resource must be uploaded with the authenticated delivery type");
  }
  if (!ALLOWED_IMAGE_FORMATS.includes(resource.format)) {
    throw new Error(`Unsupported image format: ${resource.format}`);
  }

  return db.mediaAsset.create({
    data: {
      provider: "cloudinary",
      publicId: params.publicId,
      url: resource.secure_url,
      width: resource.width,
      height: resource.height,
      bytes: resource.bytes,
      format: resource.format,
      alt: "Alumni photo",
      deliveryType: "authenticated",
      uploadedById: null,
    },
  });
}

/** Approval: moves the Cloudinary asset from authenticated to public delivery and updates the MediaAsset row to match. */
export async function publishAlumniPhoto(db: Db, mediaId: string): Promise<void> {
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });

  const result = await cloudinary.uploader.rename(asset.publicId, asset.publicId, {
    type: "authenticated",
    to_type: "upload",
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });

  await db.mediaAsset.update({
    where: { id: mediaId },
    data: { deliveryType: "upload", url: result.secure_url },
  });
}

/** Reject, withdraw-then-erase, or erase: removes the Cloudinary asset and the MediaAsset row outright. */
export async function deleteAlumniPhoto(db: Db, mediaId: string): Promise<void> {
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });

  await cloudinary.api.delete_resources([asset.publicId], {
    resource_type: "image",
    type: asset.deliveryType,
  });

  await db.mediaAsset.delete({ where: { id: mediaId } });
}

/**
 * Returns a short-lived signed URL for a pending (authenticated) photo,
 * or null when no time-limited signed delivery is available on the
 * current Cloudinary plan (see docs/MEDIA.md - token-based expiring
 * URLs require the Advanced plan or higher). A null result tells the
 * caller (the protected admin photo route) to stream the bytes itself
 * instead of redirecting to a URL.
 */
export function getSignedAlumniPhotoUrl(_publicId: string): string | null {
  return null;
}
