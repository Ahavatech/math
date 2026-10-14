import { db } from "@/lib/db";
import { getLatestArticlesPublic } from "@/server/services/journal-articles";
import { getJournalSettingsPublic, journalDisplayName } from "@/server/services/journal-settings";
import { generateRssFeed } from "@/lib/rss";
import { env } from "@/lib/env";

export const revalidate = 300;

export async function GET() {
  const [articles, settings] = await Promise.all([
    getLatestArticlesPublic(db, 20),
    getJournalSettingsPublic(),
  ]);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? env.AUTH_URL;
  const journalName = journalDisplayName(settings);

  const xml = generateRssFeed({
    siteUrl,
    title: `${journalName} - Latest Articles`,
    description: `Latest published articles from ${journalName}.`,
    items: articles.map((article) => ({
      title: article.title,
      link: `${siteUrl}/journal/articles/${article.slug}`,
      description: article.abstract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
      publishedAt: article.publishedAt ?? new Date(),
      guid: article.id,
    })),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
