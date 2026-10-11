import { db } from "@/lib/db";
import { listLatestNewsPublic } from "@/server/services/news";
import { generateNewsRss } from "@/lib/rss";
import { env } from "@/lib/env";

export const revalidate = 300;

export async function GET() {
  const posts = await listLatestNewsPublic(db, 20);
  const siteUrl = env.AUTH_URL;

  const xml = generateNewsRss({
    siteUrl,
    title: "Department of Mathematics News",
    description: "Latest news from the Department of Mathematics, Obafemi Awolowo University.",
    items: posts.map((post) => ({
      title: post.title,
      link: `${siteUrl}/news/${post.slug}`,
      description: post.excerpt ?? "",
      publishedAt: post.publishedAt ?? new Date(),
      guid: post.id,
    })),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
