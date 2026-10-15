import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { journalUploadRateLimiter } from "@/lib/rate-limit";
import { processManuscriptUpload } from "@/server/services/manuscript-upload";

// Nginx config note (required for Stage 14):
//   client_max_body_size 25m;
//   proxy_read_timeout 120s;
//   proxy_send_timeout 120s;

const ALLOWED_KINDS = new Set([
  "MANUSCRIPT",
  "TITLE_PAGE",
  "SUPPLEMENTARY",
  "RESPONSE_TO_REVIEWERS",
  "REVISED",
  "COPYEDITED",
]);

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rate = journalUploadRateLimiter.check(user.id);
  if (!rate.allowed) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  // CSRF headers — validated inside processManuscriptUpload
  const hasXRW = request.headers.get("X-Requested-With") === "fetch";
  const origin = request.headers.get("Origin");
  const allowedOrigins = process.env.NEXT_PUBLIC_APP_URL
    ? [process.env.NEXT_PUBLIC_APP_URL]
    : [];

  const kind = request.headers.get("X-File-Kind") ?? "";
  if (!ALLOWED_KINDS.has(kind)) {
    return new NextResponse("Invalid X-File-Kind", { status: 400 });
  }

  const rawName = request.headers.get("X-File-Name") ?? "upload";
  const mimeType = request.headers.get("Content-Type") ?? "application/octet-stream";

  if (!request.body) {
    return new NextResponse("Empty body", { status: 400 });
  }

  const { id: manuscriptId } = await params;

  try {
    // request.body is ReadableStream<Uint8Array<ArrayBufferLike>> (DOM type); Node's
    // Readable.fromWeb expects ReadableStream from stream/web — structurally identical
    // at runtime but TypeScript cannot bridge the two generic instantiations without an
    // escape hatch. The cast is safe: both types represent the same Web ReadableStream.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = Readable.fromWeb(request.body as any);
    const result = await processManuscriptUpload(prisma, {
      userId: user.id,
      manuscriptId,
      kind,
      originalName: rawName,
      mimeType,
      stream,
      hasXRequestedWith: hasXRW,
      origin,
      allowedOrigins,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    if (message.includes("CSRF")) return new NextResponse(message, { status: 403 });
    if (message.includes("origin")) return new NextResponse(message, { status: 403 });
    if (message.includes("not found") || message.includes("forbidden"))
      return new NextResponse("Not found", { status: 404 });
    if (message.includes("status") || message.includes("size") || message.includes("Maximum"))
      return new NextResponse(message, { status: 422 });
    if (message.includes("magic") || message.includes("PDF") || message.includes("DOCX"))
      return new NextResponse(message, { status: 422 });
    return new NextResponse("Upload failed", { status: 500 });
  }
}
