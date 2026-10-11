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
import { Badge } from "@/components/ui/badge";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { safeJsonLdString } from "@/lib/json-ld";

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    datePublished: post.publishedAt?.toISOString(),
    ...(post.cover ? { image: [post.cover.url] } : {}),
  };

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News", href: "/news" }, { label: post.title }]} />

        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{post.category}</Badge>
          {post.publishedAt ? <span>{formatDateWAT(post.publishedAt)}</span> : null}
        </div>
        <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">{post.title}</h1>

        {post.cover ? (
          <div className="relative mt-6 aspect-video overflow-hidden rounded-xl">
            <ZoomableImage src={post.cover.url} alt={post.cover.alt ?? post.title} priority />
          </div>
        ) : null}

        <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(post.body) }} />

        {others.length > 0 ? (
          <div className="mt-12 border-t border-border pt-8">
            <h2 className="font-heading text-xl font-semibold">More news</h2>
            <ul className="mt-4 space-y-3">
              {others.map((other) => (
                <li key={other.id}>
                  <Link href={`/news/${other.slug}`} className="font-medium underline">
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
