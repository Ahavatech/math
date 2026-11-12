import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listNewsPostsPublic } from "@/server/services/news";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterLinks, PageNav } from "@/components/ui/filter-links";
import { NewsCard } from "@/components/sections/news-card";
import { Newspaper } from "lucide-react";
import { humanise } from "@/lib/labels";

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
        <PageHeader
          className="mt-4"
          title="News"
          description="Announcements, achievements and research news from the department."
        />

        <div className="mt-6">
          <FilterLinks
            label="News categories"
            items={[
              { label: "All", href: categoryHref(), active: !category },
              ...CATEGORIES.map((c) => ({
                label: humanise(c),
                href: categoryHref(c),
                active: category === c,
              })),
            ]}
          />
        </div>

        {posts.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="No news yet"
            description="Check back soon for announcements and updates."
            className="mt-10"
          />
        ) : (
          <>
            <div className="mt-6 max-w-4xl">
              {posts.map((post) => (
                <NewsCard
                  key={post.id}
                  title={post.title}
                  excerpt={post.excerpt ?? undefined}
                  category={post.category}
                  publishedAt={post.publishedAt ?? new Date(0)}
                  href={`/news/${post.slug}`}
                  pinned={post.isPinned}
                  coverUrl={post.cover?.url}
                  coverAlt={post.cover?.alt ?? undefined}
                />
              ))}
            </div>

            {totalPages > 1 ? (
              <PageNav
                page={page}
                totalPages={totalPages}
                hrefFor={(target) =>
                  `/news?page=${target}${category ? `&category=${category}` : ""}`
                }
              />
            ) : null}
          </>
        )}
      </Container>
    </Section>
  );
}
