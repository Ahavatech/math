import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { cloudinary } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { cvUploadSigningRateLimiter } from "@/lib/rate-limit";
import { ARTICLE_PDF_FOLDER } from "@/server/services/journal-article-pdf";

/** Signs a direct-to-Cloudinary PDF upload for a journal article, gated by journal.edit. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.edit")) {
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
    folder: ARTICLE_PDF_FOLDER,
    allowed_formats: "pdf",
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    signature,
    timestamp,
    folder: ARTICLE_PDF_FOLDER,
    allowedFormats: ["pdf"],
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
  });
}
