import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getJournalSettingsPublic, journalDisplayName } from "@/server/services/journal-settings";
import { getJournalPagePublic } from "@/server/services/journal-pages";
import { getLatestPublicIssue } from "@/server/services/journal-issues";
import { getLatestArticlesPublic } from "@/server/services/journal-articles";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getJournalSettingsPublic();
  const name = journalDisplayName(settings);
  return {
    title: name,
    openGraph: { title: name, type: "website" },
  };
}

export default async function JournalHomePage() {
  const [settings, callForPapers, latestIssue, latestArticles] = await Promise.all([
    getJournalSettingsPublic(),
    getJournalPagePublic("journal-call-for-papers"),
    getLatestPublicIssue(),
    getLatestArticlesPublic(db, 6),
  ]);

  const name = journalDisplayName(settings);

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal" }]} />
        <PageHeader
          className="mt-4"
          title={name}
          description={settings.publisher ? settings.publisher : undefined}
        />

        <div className="mt-10 grid gap-12 lg:grid-cols-[2fr_1fr] lg:gap-16">
          <div>
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
              Latest articles
            </h2>
            {latestArticles.length > 0 ? (
              <ul>
                {latestArticles.map((article) => (
                  <li key={article.id} className="index-row border-b border-border">
                    <Link
                      href={`/journal/articles/${article.slug}`}
                      className="flex items-start justify-between gap-4 py-4"
                    >
                      <span>
                        <span className="block font-heading text-xl leading-snug font-semibold">
                          {article.title}
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          {article.authors.map((a) => a.name).join(", ")}
                        </span>
                      </span>
                      <ArrowRight
                        className="row-arrow mt-1.5 size-4 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-b border-border py-5 text-muted-foreground">
                No articles have been published yet.
              </p>
            )}
            <p className="mt-4">
              <Link href="/journal/articles" className="link-rule py-2 font-medium text-primary">
                All articles
              </Link>
            </p>
          </div>

          <aside className="space-y-10">
            {latestIssue ? (
              <div>
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                  Latest issue
                </h2>
                <Link
                  href={`/journal/issues/${latestIssue.volume}/${latestIssue.number}`}
                  className="index-row mt-1 block border-b border-border py-4"
                >
                  <span className="tabular block font-heading text-xl font-semibold">
                    Vol. {latestIssue.volume}, No. {latestIssue.number}
                  </span>
                  <span className="block text-muted-foreground">
                    {latestIssue.year}
                    {latestIssue.title ? `, ${latestIssue.title}` : ""}
                  </span>
                </Link>
                <p className="mt-2">
                  <Link href="/journal/issues" className="link-rule py-2 font-medium text-primary">
                    Browse the archive
                  </Link>
                </p>
              </div>
            ) : null}

            {callForPapers ? (
              <div>
                <h2 className="border-b-2 border-accent pb-2 font-heading text-2xl font-semibold">
                  Call for papers
                </h2>
                <Prose
                  className="mt-3 line-clamp-6 text-base"
                  dangerouslySetInnerHTML={{ __html: renderRichText(callForPapers.body) }}
                />
                <Link
                  href="/journal/call-for-papers"
                  className="link-rule mt-2 inline-block py-2 font-medium text-primary"
                >
                  Read more
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      </Container>
    </Section>
  );
}
