import Link from "next/link";
import { listIssuesPublic } from "@/server/services/journal-issues";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const revalidate = 300;

export async function generateMetadata() {
  return { title: "Issue Archive" };
}

export default async function JournalIssuesPage() {
  const issues = await listIssuesPublic();
  const byYear = new Map<number, typeof issues>();
  for (const issue of issues) {
    const list = byYear.get(issue.year) ?? [];
    list.push(issue);
    byYear.set(issue.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Archive" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold">Issue archive</h1>

        {years.length === 0 ? <p className="mt-4 text-muted-foreground">No issues have been published yet.</p> : null}

        {years.map((year) => (
          <div key={year} className="mt-8">
            <h2 className="font-heading text-xl font-semibold">{year}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {byYear.get(year)!.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/journal/issues/${issue.volume}/${issue.number}`}
                  className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-primary"
                >
                  {issue.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={issue.cover.url} alt={issue.cover.alt ?? ""} className="h-20 w-16 rounded object-cover" />
                  ) : null}
                  <div>
                    <p className="font-medium">Vol. {issue.volume}, No. {issue.number}</p>
                    {issue.title ? <p className="text-sm text-muted-foreground">{issue.title}</p> : null}
                    <p className="text-sm text-muted-foreground">{issue.articleCount} article(s)</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </Container>
    </Section>
  );
}
