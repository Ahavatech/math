import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { cloudinary, ALLOWED_IMAGE_FORMATS } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { validateAlumniLinkToken } from "@/server/services/alumni-links";
import { ALUMNI_PENDING_FOLDER } from "@/server/services/alumni-photos";
import { alumniPhotoSigningIpRateLimiter, alumniPhotoSigningLinkRateLimiter } from "@/server/services/alumni-spam";

const MAX_ALUMNI_PHOTO_BYTES = 2 * 1024 * 1024;

const bodySchema = z.object({
  token: z.string().min(1),
});

/**
 * Signs an alumni photo upload. No session is involved - authorization
 * comes from a valid, unexpired, active alumni link token, matching
 * the public submission form's own no-session design (section 5 of
 * docs/prompts/09-alumni.md). Always signs for the `authenticated`
 * delivery type into the pending folder; nothing here ever signs a
 * public upload.
 */
export async function POST(request: Request) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

  if (!alumniPhotoSigningIpRateLimiter.check(ip).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const validation = await validateAlumniLinkToken(db, parsed.data.token);
  if (!validation.ok) {
    return NextResponse.json({ error: "This link is no longer valid" }, { status: 403 });
  }

  if (!alumniPhotoSigningLinkRateLimiter.check(validation.link.id).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: ALUMNI_PENDING_FOLDER,
    type: "authenticated",
    allowed_formats: ALLOWED_IMAGE_FORMATS.join(","),
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    signature,
    timestamp,
    folder: paramsToSign.folder,
    type: paramsToSign.type,
    allowedFormats: ALLOWED_IMAGE_FORMATS,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    maxBytes: MAX_ALUMNI_PHOTO_BYTES,
  });
}
