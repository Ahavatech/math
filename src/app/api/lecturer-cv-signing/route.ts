import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { cloudinary } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/rbac";
import { cvUploadSigningRateLimiter } from "@/lib/rate-limit";

/**
 * Separate from /api/upload-signing: authorisation here is by ownership
 * (the caller's own LecturerProfile), not by a folder permission, and
 * the signed folder is scoped to that exact profile's id - a lecturer
 * can sign an upload only into their own CV folder, structurally, since
 * the folder path itself names the owning profile.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const rate = cvUploadSigningRateLimiter.check(`${ip}:${user.id}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const profile = await db.lecturerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return NextResponse.json({ error: "No lecturer profile for this account" }, { status: 403 });
  }

  const folder = `oau-maths/lecturers/cv/${profile.id}`;
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder,
    allowed_formats: "pdf",
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    allowedFormats: ["pdf"],
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
  });
}
