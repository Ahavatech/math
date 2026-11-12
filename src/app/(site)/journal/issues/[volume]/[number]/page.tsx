import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPublicIssueByVolumeNumber } from "@/server/services/journal-issues";
import { listArticlesByIssuePublic } from "@/server/services/journal-articles";
import { renderRichText } from "@/lib/sanitize-html";
import { humanise } from "@/lib/labels";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ volume: string; number: string }> }) {
  const { volume, number } = await params;
  const issue = await getPublicIssueByVolumeNumber(Number(volume), Number(number));
  return { title: issue ? `Vol. ${issue.volume}, No. ${issue.number}` : "Issue" };
}

export default async function JournalIssueDetailPage({ params }: { params: Promise<{ volume: string; number: string }> }) {
  const { volume, number } = await params;
  const issue = await getPublicIssueByVolumeNumber(Number(volume), Number(number));
  if (!issue) notFound();

  const articles = await listArticlesByIssuePublic(db, issue.id);

  return (
    <Section>
      <Container>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Journal", href: "/journal" },
            { label: "Archive", href: "/journal/issues" },
            { label: `Vol. ${issue.volume}, No. ${issue.number}` },
          ]}
        />
        <PageHeader
          className="mt-4"
          title={`Vol. ${issue.volume}, No. ${issue.number} (${issue.year})`}
          description={issue.title ?? undefined}
        />
        {issue.description ? (
          <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(issue.description) }} />
        ) : null}

        <h2 className="mt-12 max-w-4xl border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
          Articles
        </h2>
        {articles.length === 0 ? (
          <p className="max-w-4xl border-b border-border py-5 text-muted-foreground">
            No articles published in this issue yet.
          </p>
        ) : (
          <ul className="max-w-4xl">
            {articles.map((article) => (
              <li key={article.id} className="border-b border-border py-5">
                <Link
                  href={`/journal/articles/${article.slug}`}
                  className="link-rule font-heading text-xl leading-snug font-semibold"
                >
                  {article.title}
                </Link>
                <p className="mt-1 text-muted-foreground">
                  {article.authors.map((a) => a.name).join(", ")}
                </p>
                <p className="tabular mt-0.5 text-sm text-muted-foreground">
                  {humanise(article.type)}
                  {article.pageStart ? `, pp. ${article.pageStart}${article.pageEnd ? `-${article.pageEnd}` : ""}` : ""}
                </p>
                <a
                  href={`/journal/articles/${article.slug}/pdf`}
                  className="link-rule mt-1 inline-block py-1.5 font-medium text-primary"
                >
                  PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
