import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPublicIssueByVolumeNumber } from "@/server/services/journal-issues";
import { listArticlesByIssuePublic } from "@/server/services/journal-articles";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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
      <Container className="max-w-3xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Journal", href: "/journal" },
            { label: "Archive", href: "/journal/issues" },
            { label: `Vol. ${issue.volume}, No. ${issue.number}` },
          ]}
        />
        <h1 className="mt-4 font-heading text-3xl font-semibold">
          Vol. {issue.volume}, No. {issue.number} ({issue.year})
        </h1>
        {issue.title ? <p className="mt-1 text-lg text-muted-foreground">{issue.title}</p> : null}
        {issue.description ? (
          <Prose className="mt-4" dangerouslySetInnerHTML={{ __html: renderRichText(issue.description) }} />
        ) : null}

        <h2 className="mt-8 font-heading text-xl font-semibold">Articles</h2>
        {articles.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No articles published in this issue yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {articles.map((article) => (
              <li key={article.id} className="py-3">
                <Link href={`/journal/articles/${article.slug}`} className="font-medium text-primary hover:underline">
                  {article.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {article.authors.map((a) => a.name).join(", ")}
                  {article.pageStart ? ` - pp. ${article.pageStart}${article.pageEnd ? `-${article.pageEnd}` : ""}` : ""}
                  {` - ${article.type.replace(/_/g, " ").toLowerCase()}`}
                </p>
                <a href={`/journal/articles/${article.slug}/pdf`} className="text-sm text-primary hover:underline">PDF</a>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
