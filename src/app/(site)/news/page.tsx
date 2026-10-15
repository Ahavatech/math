import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listNewsPostsPublic } from "@/server/services/news";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { CloudImage } from "@/components/ui/cloud-image";
import { Badge } from "@/components/ui/badge";
import { Newspaper } from "lucide-react";
import { formatDateWAT } from "@/lib/time";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "News",
  description: "Announcements, achievements and research news from the Department of Mathematics.",
};

const PER_PAGE = 12;
const CATEGORIES = ["ANNOUNCEMENT", "ACHIEVEMENT", "ADMISSION", "RESEARCH"] as const;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const category = CATEGORIES.includes(params.category as never) ? params.category : undefined;

  const { posts, total } = await listNewsPostsPublic(db, { page, perPage: PER_PAGE, category });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function categoryHref(value?: string) {
    return value ? `/news?category=${value}` : "/news";
  }

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">News</h1>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={categoryHref()}>
            <Badge variant={!category ? "default" : "outline"}>All</Badge>
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={categoryHref(c)}>
              <Badge variant={category === c ? "default" : "outline"}>{c}</Badge>
            </Link>
          ))}
        </div>

        {posts.length === 0 ? (
          <EmptyState icon={Newspaper} title="No news yet" description="Check back soon for announcements and updates." className="mt-10" />
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link key={post.id} href={`/news/${post.slug}`} className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/40">
                  {post.cover ? (
                    <div className="relative mb-3 aspect-video overflow-hidden rounded-md">
                      <CloudImage src={post.cover.url} alt={post.cover.alt ?? post.title} fill sizes="(min-width: 1024px) 360px, 100vw" className="object-cover" />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{post.category}</Badge>
                    {post.isPinned ? <Badge>Pinned</Badge> : null}
                    <span>{post.publishedAt ? formatDateWAT(post.publishedAt) : ""}</span>
                  </div>
                  <h2 className="mt-2 font-heading text-lg font-semibold">{post.title}</h2>
                  {post.excerpt ? <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p> : null}
                </Link>
              ))}
            </div>

            {totalPages > 1 ? (
              <nav className="mt-10 flex justify-center gap-4 text-sm" aria-label="Pagination">
                {page > 1 ? (
                  <Link href={`/news?page=${page - 1}${category ? `&category=${category}` : ""}`} className="underline">
                    Previous
                  </Link>
                ) : null}
                <span className="text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link href={`/news?page=${page + 1}${category ? `&category=${category}` : ""}`} className="underline">
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </Container>
    </Section>
  );
}
