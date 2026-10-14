import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getArticleBySlugPublic, findArticleBySlugOrPrevious } from "@/server/services/journal-articles";
import { getJournalSettingsPublic, journalDisplayName } from "@/server/services/journal-settings";
import { renderRichText } from "@/lib/sanitize-html";
import { formatApaCitation } from "@/lib/citation";
import { buildCitationMetaTags, buildDublinCoreMetaTags, buildScholarlyArticleJsonLd } from "@/lib/journal-meta";
import { safeJsonLdString } from "@/lib/json-ld";
import { env } from "@/lib/env";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

function siteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL ?? env.AUTH_URL;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlugPublic(db, slug);
  if (!article) return { title: "Article" };
  return {
    title: article.title,
    description: article.abstract.replace(/<[^>]+>/g, "").slice(0, 200),
    openGraph: { title: article.title, type: "article" },
  };
}

export default async function JournalArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const lookup = await findArticleBySlugOrPrevious(db, slug);
  if (!lookup) notFound();
  if (lookup.redirectTo) redirect(`/journal/articles/${lookup.redirectTo}`);

  const [article, settings] = await Promise.all([
    getArticleBySlugPublic(db, slug),
    getJournalSettingsPublic(),
  ]);
  if (!article) notFound();

  const journalName = journalDisplayName(settings);
  const base = siteUrl();
  const abstractUrl = `${base}/journal/articles/${article.slug}`;
  const pdfUrl = `${base}/journal/articles/${article.slug}/pdf`;
  const publishedAt = article.publishedAt ?? new Date();
  const year = publishedAt.getUTCFullYear();

  const citationInput = {
    title: article.title,
    authors: article.authors.map((a) => a.name),
    year,
    journalName,
    volume: article.issue?.volume ?? null,
    issue: article.issue?.number ?? null,
    pageStart: article.pageStart,
    pageEnd: article.pageEnd,
    doi: article.doi,
    slug: article.slug,
  };
  const apaCitation = formatApaCitation(citationInput);

  const plainAbstract = article.abstract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const citationTags = buildCitationMetaTags({
    title: article.title,
    authors: article.authors.map((a) => a.name),
    publishedAt,
    journalName,
    issn: settings.issn || null,
    volume: article.issue?.volume ?? null,
    issue: article.issue?.number ?? null,
    pageStart: article.pageStart,
    pageEnd: article.pageEnd,
    doi: article.doi,
    pdfUrl,
    abstractUrl,
    keywords: article.keywords,
    abstract: plainAbstract,
  });
  const dcTags = buildDublinCoreMetaTags({
    title: article.title,
    authors: article.authors.map((a) => a.name),
    publishedAt,
    journalName,
    pdfUrl,
    abstractUrl,
    keywords: article.keywords,
    abstract: plainAbstract,
  });
  const jsonLd = buildScholarlyArticleJsonLd({
    title: article.title,
    authors: article.authors.map((a) => a.name),
    publishedAt,
    journalName,
    issn: settings.issn || null,
    pdfUrl,
    abstractUrl,
    keywords: article.keywords,
    abstract: plainAbstract,
  });

  const licenseLabel = article.license || settings.license;

  return (
    <Section>
      {[...citationTags, ...dcTags].map((tag, i) => (
        <meta key={`${tag.name}-${i}`} name={tag.name} content={tag.content} />
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />

      <Container className="max-w-3xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Journal", href: "/journal" },
            { label: "Articles", href: "/journal/articles" },
            { label: article.title },
          ]}
        />
        <h1 className="mt-4 font-heading text-3xl font-semibold">{article.title}</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {article.authors.map((a, i) => (
            <span key={a.id}>
              {i > 0 ? ", " : ""}
              {a.name}
              {a.orcid ? (
                <a href={`https://orcid.org/${a.orcid}`} rel="noopener noreferrer" target="_blank" className="ml-1 text-primary hover:underline">
                  ORCID
                </a>
              ) : null}
            </span>
          ))}
        </p>
        {article.authors.some((a) => a.affiliation) ? (
          <p className="text-sm text-muted-foreground">
            {article.authors.filter((a) => a.affiliation).map((a) => a.affiliation).join("; ")}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {article.issue ? (
            <Link href={`/journal/issues/${article.issue.volume}/${article.issue.number}`} className="text-primary hover:underline">
              Vol. {article.issue.volume}, No. {article.issue.number} ({article.issue.year})
            </Link>
          ) : (
            <span>Online first</span>
          )}
          {article.doi ? (
            <a href={`https://doi.org/${article.doi}`} rel="noopener noreferrer" target="_blank" className="text-primary hover:underline">
              https://doi.org/{article.doi}
            </a>
          ) : null}
          {licenseLabel ? <span>{licenseLabel}</span> : null}
        </div>

        <h2 className="mt-6 font-heading text-lg font-semibold">Abstract</h2>
        <Prose className="mt-2" dangerouslySetInnerHTML={{ __html: renderRichText(article.abstract) }} />

        {article.keywords.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {article.keywords.map((kw) => (
              <Link key={kw} href={`/journal/articles?q=${encodeURIComponent(kw)}`} className="rounded-full border border-border px-2 py-0.5 text-primary hover:underline">
                {kw}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {article.receivedAt ? <span>Received: {article.receivedAt.toISOString().slice(0, 10)}</span> : null}
          {article.acceptedAt ? <span>Accepted: {article.acceptedAt.toISOString().slice(0, 10)}</span> : null}
        </div>

        <div className="mt-6">
          <a href={`/journal/articles/${article.slug}/pdf`}>
            <Button>Download PDF</Button>
          </a>
        </div>

        <div className="mt-8 rounded-md border border-border p-4">
          <h2 className="font-heading text-lg font-semibold">How to cite</h2>
          <p className="mt-2 text-sm">{apaCitation}</p>
          <div className="mt-2 flex gap-3 text-sm">
            <a href={`/journal/articles/${article.slug}/cite.bib`} className="text-primary hover:underline">BibTeX</a>
            <a href={`/journal/articles/${article.slug}/cite.ris`} className="text-primary hover:underline">RIS</a>
          </div>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          Share:{" "}
          <a href={abstractUrl} className="text-primary hover:underline">{abstractUrl}</a>
        </div>
      </Container>
    </Section>
  );
}
