import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getArticleBySlugPublic } from "@/server/services/journal-articles";
import { getJournalSettingsPublic, journalDisplayName } from "@/server/services/journal-settings";
import { formatRis } from "@/lib/citation";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlugPublic(db, slug);
  if (!article) return new NextResponse("Not found", { status: 404 });

  const settings = await getJournalSettingsPublic();
  const year = (article.publishedAt ?? new Date()).getUTCFullYear();

  const ris = formatRis({
    title: article.title,
    authors: article.authors.map((a) => a.name),
    year,
    journalName: journalDisplayName(settings),
    volume: article.issue?.volume ?? null,
    issue: article.issue?.number ?? null,
    pageStart: article.pageStart,
    pageEnd: article.pageEnd,
    doi: article.doi,
    slug: article.slug,
  });

  return new NextResponse(ris, {
    headers: {
      "Content-Type": "application/x-research-info-systems; charset=utf-8",
      "Content-Disposition": `attachment; filename="${article.slug}.ris"`,
    },
  });
}
