import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission, UnauthorizedError } from "@/lib/rbac";
import { getSignedAlumniPhotoUrl, buildAlumniPhotoFetchUrl } from "@/server/services/alumni-photos";

/**
 * The only way an admin ever sees an alumni photo while it is still
 * pending (Cloudinary `type: authenticated`). Checks `alumni.review`,
 * then either redirects to a short-lived signed URL (not currently
 * available on this Cloudinary plan, see docs/MEDIA.md) or streams the
 * bytes itself with `Cache-Control: private, no-store` so the raw
 * Cloudinary URL never reaches the browser.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const user = await getCurrentUser();
  try {
    requirePermission(user, "alumni.review");
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }

  const { entryId } = await params;
  const entry = await db.alumniEntry.findUnique({ where: { id: entryId }, include: { photo: true } });
  if (!entry || !entry.photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = getSignedAlumniPhotoUrl(entry.photo.publicId);
  if (signedUrl) {
    return NextResponse.redirect(signedUrl);
  }

  const fetchUrl = buildAlumniPhotoFetchUrl(entry.photo.publicId, entry.photo.deliveryType);
  const upstream = await fetch(fetchUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Could not load photo" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
