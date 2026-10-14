export interface ArticleMetaInput {
  title: string;
  authors: string[];
  publishedAt: Date;
  journalName: string;
  issn?: string | null;
  volume?: number | null;
  issue?: number | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  doi?: string | null;
  pdfUrl: string;
  abstractUrl: string;
  keywords: string[];
  abstract: string;
  language?: string;
}

export interface MetaTag {
  name: string;
  content: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Highwire Press `citation_*` meta tags, per Google Scholar's inclusion
 * guidelines (fetched 2026-10-14, see docs/JOURNAL.md): citation_title,
 * citation_author (required, repeated once per author - omitting
 * affiliations), and citation_publication_date in "YYYY/M/D" form are
 * required; everything else here is Scholar's recommended set for a
 * journal article to be citable.
 */
export function buildCitationMetaTags(input: ArticleMetaInput): MetaTag[] {
  const tags: MetaTag[] = [{ name: "citation_title", content: input.title }];
  for (const author of input.authors) {
    tags.push({ name: "citation_author", content: author });
  }
  tags.push({
    name: "citation_publication_date",
    content: `${input.publishedAt.getUTCFullYear()}/${input.publishedAt.getUTCMonth() + 1}/${input.publishedAt.getUTCDate()}`,
  });
  tags.push({ name: "citation_journal_title", content: input.journalName });
  if (input.issn) tags.push({ name: "citation_issn", content: input.issn });
  if (input.volume) tags.push({ name: "citation_volume", content: String(input.volume) });
  if (input.issue) tags.push({ name: "citation_issue", content: String(input.issue) });
  if (input.pageStart) tags.push({ name: "citation_firstpage", content: String(input.pageStart) });
  if (input.pageEnd) tags.push({ name: "citation_lastpage", content: String(input.pageEnd) });
  if (input.doi) tags.push({ name: "citation_doi", content: input.doi });
  tags.push({ name: "citation_pdf_url", content: input.pdfUrl });
  tags.push({ name: "citation_abstract_html_url", content: input.abstractUrl });
  if (input.keywords.length > 0) {
    tags.push({ name: "citation_keywords", content: input.keywords.join("; ") });
  }
  tags.push({ name: "citation_language", content: input.language ?? "en" });
  return tags;
}

/** Dublin Core fallback tags (kept alongside citation_* - Scholar treats DC.* as a last resort). */
export function buildDublinCoreMetaTags(input: ArticleMetaInput): MetaTag[] {
  const tags: MetaTag[] = [{ name: "DC.title", content: input.title }];
  for (const author of input.authors) {
    tags.push({ name: "DC.creator", content: author });
  }
  tags.push({ name: "DC.date", content: isoDate(input.publishedAt) });
  tags.push({ name: "DC.identifier", content: input.doi || input.abstractUrl });
  return tags;
}

/** schema.org ScholarlyArticle JSON-LD. Pass the result through safeJsonLdString before embedding. */
export function buildScholarlyArticleJsonLd(input: ArticleMetaInput): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: input.title,
    description: input.abstract,
    author: input.authors.map((name) => ({ "@type": "Person", name })),
    datePublished: isoDate(input.publishedAt),
    url: input.abstractUrl,
    isPartOf: {
      "@type": "Periodical",
      name: input.journalName,
      ...(input.issn ? { issn: input.issn } : {}),
    },
    keywords: input.keywords,
    inLanguage: input.language ?? "en",
  };
  if (input.doi) jsonLd.sameAs = `https://doi.org/${input.doi}`;
  return jsonLd;
}
