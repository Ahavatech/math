import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getArticlePdfForRoute } from "@/server/services/journal-articles";
import { articlePdfFilename as buildFilename } from "@/server/services/journal-article-pdf";

/**
 * Streams a published article's PDF from our own domain. Draft/hidden
 * articles, or ones whose issue has since been unpublished, 404 - never
 * reveal whether a non-public slug exists, and never leak the raw
 * Cloudinary URL into any response header or body.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await getArticlePdfForRoute(db, slug);
  if (!info) {
    return new NextResponse("Not found", { status: 404 });
  }

  const upstream = await fetch(info.fileUrl);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filename = buildFilename(info.firstAuthorName, info.year, info.title);

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
