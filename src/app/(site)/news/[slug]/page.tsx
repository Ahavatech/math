import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPublishedNewsPostBySlug, findNewsPostBySlugOrPrevious, listOtherNewsPublic } from "@/server/services/news";
import { renderRichText } from "@/lib/sanitize-html";
import { formatDateWAT } from "@/lib/time";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { humanise } from "@/lib/labels";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { safeJsonLdString, buildNewsArticleJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedNewsPostBySlug(db, slug);
  if (!post) return { robots: { index: false, follow: false } };
  return {
    title: post.title,
    description: post.excerpt || post.title,
    openGraph: post.cover ? { images: [{ url: post.cover.url }] } : undefined,
  };
}

export default async function NewsPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedNewsPostBySlug(db, slug);

  if (!post) {
    const lookup = await findNewsPostBySlugOrPrevious(db, slug);
    if (lookup?.redirectTo) {
      redirect(`/news/${lookup.redirectTo}`);
    }
    notFound();
  }

  const others = await listOtherNewsPublic(db, post.id, 3);

  const jsonLd = buildNewsArticleJsonLd({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    coverUrl: post.cover?.url,
    siteUrl: SITE_URL,
  });

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News", href: "/news" }, { label: post.title }]} />

        <p className="tabular mt-6 text-muted-foreground">
          <span className="font-semibold text-accent">{humanise(post.category)}</span>
          {post.publishedAt ? `, ${formatDateWAT(post.publishedAt)}` : ""}
        </p>
        <h1 className="mt-2 border-b-2 border-foreground pb-6 font-heading text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl">
          {post.title}
        </h1>

        {post.cover ? (
          <div className="relative mt-6 aspect-video overflow-hidden border border-border">
            <ZoomableImage src={post.cover.url} alt={post.cover.alt ?? post.title} priority />
          </div>
        ) : null}

        <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(post.body) }} />

        {others.length > 0 ? (
          <div className="mt-16">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
              More news
            </h2>
            <ul>
              {others.map((other) => (
                <li key={other.id} className="index-row border-b border-border">
                  <Link href={`/news/${other.slug}`} className="block py-4 font-heading text-lg font-semibold">
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />
    </Section>
  );
}
