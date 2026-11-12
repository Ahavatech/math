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
    doi: article.doi,
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
        {article.status === "RETRACTED" ? (
          <div className="mt-4 border-2 border-destructive bg-destructive/5 p-4">
            <p className="text-lg font-semibold text-destructive">This article has been retracted.</p>
            {article.retractionReason ? (
              <p className="mt-1 text-destructive">{article.retractionReason}</p>
            ) : null}
          </div>
        ) : null}

        {article.status === "CORRECTED" && Array.isArray(article.notices) && (article.notices as string[]).length > 0 ? (
          <div className="mt-4 space-y-1 border-2 border-foreground bg-secondary p-4">
            <p className="text-lg font-semibold">Correction notice</p>
            {(article.notices as string[]).map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        ) : null}

        <h1 className="mt-6 font-heading text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl">{article.title}</h1>

        <p className="mt-4 text-lg text-foreground">
          {article.authors.map((a, i) => (
            <span key={a.id}>
              {i > 0 ? ", " : ""}
              {a.name}
              {a.orcid ? (
                <a href={`https://orcid.org/${a.orcid}`} rel="noopener noreferrer" target="_blank" className="link-rule ml-1.5 text-sm font-medium text-primary">
                  ORCID
                </a>
              ) : null}
            </span>
          ))}
        </p>
        {article.authors.some((a) => a.affiliation) ? (
          <p className="text-muted-foreground">
            {article.authors.filter((a) => a.affiliation).map((a) => a.affiliation).join("; ")}
          </p>
        ) : null}

        <div className="tabular mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-4 text-muted-foreground">
          {article.issue ? (
            <Link href={`/journal/issues/${article.issue.volume}/${article.issue.number}`} className="link-rule font-medium text-primary">
              Vol. {article.issue.volume}, No. {article.issue.number} ({article.issue.year})
            </Link>
          ) : (
            <span>Online first</span>
          )}
          {article.doi ? (
            <a href={`https://doi.org/${article.doi}`} rel="noopener noreferrer" target="_blank" className="link-rule font-medium text-primary">
              https://doi.org/{article.doi}
            </a>
          ) : null}
          {licenseLabel ? <span>{licenseLabel}</span> : null}
        </div>

        <h2 className="mt-10 border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Abstract</h2>
        <Prose className="mt-4" dangerouslySetInnerHTML={{ __html: renderRichText(article.abstract) }} />

        {article.keywords.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {article.keywords.map((kw) => (
              <Link key={kw} href={`/journal/articles?q=${encodeURIComponent(kw)}`} className="inline-flex min-h-9 items-center border border-foreground px-3 text-[0.9375rem] font-medium transition-colors hover:bg-secondary">
                {kw}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="tabular mt-6 flex flex-wrap gap-6 text-muted-foreground">
          {article.receivedAt ? <span>Received: {article.receivedAt.toISOString().slice(0, 10)}</span> : null}
          {article.acceptedAt ? <span>Accepted: {article.acceptedAt.toISOString().slice(0, 10)}</span> : null}
        </div>

        <div className="mt-8">
          <a
            href={`/journal/articles/${article.slug}/pdf`}
            className="inline-flex h-12 items-center bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground"
          >
            Download PDF
          </a>
        </div>

        <div className="mt-12 border-t-2 border-foreground pt-4">
          <h2 className="font-heading text-xl font-semibold">How to cite</h2>
          <p className="mt-2">{apaCitation}</p>
          <div className="mt-2 flex gap-5">
            <a href={`/journal/articles/${article.slug}/cite.bib`} className="link-rule py-1.5 font-medium text-primary">BibTeX</a>
            <a href={`/journal/articles/${article.slug}/cite.ris`} className="link-rule py-1.5 font-medium text-primary">RIS</a>
          </div>
        </div>

        <div className="mt-6 text-sm break-all text-muted-foreground">
          Share:{" "}
          <a href={abstractUrl} className="link-rule text-primary">{abstractUrl}</a>
        </div>
      </Container>
    </Section>
  );
}
