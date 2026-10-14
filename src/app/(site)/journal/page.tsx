import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getJournalSettingsPublic, journalDisplayName } from "@/server/services/journal-settings";
import { getJournalPagePublic } from "@/server/services/journal-pages";
import { getLatestPublicIssue } from "@/server/services/journal-issues";
import { getLatestArticlesPublic } from "@/server/services/journal-articles";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

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
      <Container className="max-w-4xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">{name}</h1>
        {settings.publisher ? <p className="mt-2 text-muted-foreground">{settings.publisher}</p> : null}

        <nav className="mt-6 flex flex-wrap gap-3 text-sm" aria-label="Journal sections">
          <Link href="/journal/about" className="text-primary hover:underline">About</Link>
          <Link href="/journal/guidelines" className="text-primary hover:underline">Guidelines</Link>
          <Link href="/journal/editorial-board" className="text-primary hover:underline">Editorial board</Link>
          <Link href="/journal/issues" className="text-primary hover:underline">Archive</Link>
        </nav>

        {callForPapers ? (
          <div className="mt-8 rounded-md border border-border bg-muted p-4">
            <h2 className="font-heading text-lg font-semibold">Call for papers</h2>
            <Prose className="mt-2" dangerouslySetInnerHTML={{ __html: renderRichText(callForPapers.body) }} />
            <Link href="/journal/call-for-papers" className="mt-2 inline-block text-sm text-primary hover:underline">Read more</Link>
          </div>
        ) : null}

        {latestIssue ? (
          <div className="mt-8">
            <h2 className="font-heading text-xl font-semibold">Latest issue</h2>
            <Link href={`/journal/issues/${latestIssue.volume}/${latestIssue.number}`} className="mt-2 block text-primary hover:underline">
              Vol. {latestIssue.volume}, No. {latestIssue.number} ({latestIssue.year}){latestIssue.title ? ` - ${latestIssue.title}` : ""}
            </Link>
          </div>
        ) : null}

        {latestArticles.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-heading text-xl font-semibold">Latest articles</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {latestArticles.map((article) => (
                <Link key={article.id} href={`/journal/articles/${article.slug}`}>
                  <Card className="h-full transition-colors hover:border-primary">
                    <CardHeader>
                      <CardTitle className="text-base">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {article.authors.map((a) => a.name).join(", ")}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-10">
          <Link href="/journal/issues"><Button variant="outline">Browse the archive</Button></Link>
        </div>
      </Container>
    </Section>
  );
}
