import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import {
  decideManuscriptFileDownload,
  streamManuscriptFileDownload,
  manuscriptFileDownloadRateLimiter,
} from "@/server/services/manuscript-file-download";

/**
 * Requires a session, applies the manuscript-access policy, streams
 * through the private storage helper, and logs exactly one audit row
 * per successful download. Returns 404 (never 403) for a file the
 * caller may not see, including one that does not exist - the
 * response is identical either way, so existence is never leaked.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rate = manuscriptFileDownloadRateLimiter.check(user.id);
  if (!rate.allowed) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const { fileId } = await params;
  // A hostile fileId (path traversal attempt, null bytes, etc.) simply
  // fails to match any row in the lookup below and falls through to the
  // same 404 - no special-casing needed here.
  const decision = await decideManuscriptFileDownload(user, fileId);
  if (!decision.allowed) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = await streamManuscriptFileDownload(decision, user.id, fileId, contextFromHeaders(await headers()));

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": decision.mimeType,
      "Content-Disposition": `attachment; filename="${decision.displayFilename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
