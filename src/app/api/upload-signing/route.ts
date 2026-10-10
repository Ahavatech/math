import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { cloudinary, ALLOWED_IMAGE_FORMATS } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { isMediaFolder, permissionForFolder, cloudinaryFolder } from "@/lib/media-folders";
import { uploadSigningRateLimiter } from "@/lib/rate-limit";

const bodySchema = z.object({
  folder: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const rate = uploadSigningRateLimiter.check(`${ip}:${user.id}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isMediaFolder(parsed.data.folder)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  const folder = parsed.data.folder;
  if (!hasPermission(user, permissionForFolder(folder))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: cloudinaryFolder(folder),
    allowed_formats: ALLOWED_IMAGE_FORMATS.join(","),
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    env.CLOUDINARY_API_SECRET,
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder: paramsToSign.folder,
    allowedFormats: ALLOWED_IMAGE_FORMATS,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
  });
}
