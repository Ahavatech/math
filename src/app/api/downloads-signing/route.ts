import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { cloudinary } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { cvUploadSigningRateLimiter } from "@/lib/rate-limit";
import { DOWNLOADS_FOLDER } from "@/server/services/downloads";

/**
 * Separate from /api/upload-signing (which only ever signs the image
 * formats, never pdf) and from /api/lecturer-cv-signing (which scopes
 * the folder to one lecturer's own profile). This one checks
 * students.manage and signs into the single shared downloads folder,
 * the same reuse-the-PDF-pipeline approach docs/MEDIA.md documents for
 * the lecturer CV flow.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const rate = cvUploadSigningRateLimiter.check(`${ip}:${user.id}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: DOWNLOADS_FOLDER,
    allowed_formats: "pdf",
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    signature,
    timestamp,
    folder: DOWNLOADS_FOLDER,
    allowedFormats: ["pdf"],
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
  });
}
