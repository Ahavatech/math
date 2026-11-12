import Link from "next/link";
import { listIssuesPublic } from "@/server/services/journal-issues";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";

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
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Archive" }]} />
        <PageHeader className="mt-4" title="Issue archive" />

        {years.length === 0 ? (
          <p className="mt-8 border-t border-border py-5 text-muted-foreground">
            No issues have been published yet.
          </p>
        ) : null}

        {years.map((year) => (
          <section key={year} className="mt-10 max-w-4xl">
            <h2 className="tabular border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold text-accent">
              {year}
            </h2>
            <ul>
              {byYear.get(year)!.map((issue) => (
                <li key={issue.id} className="index-row border-b border-border">
                  <Link
                    href={`/journal/issues/${issue.volume}/${issue.number}`}
                    className="flex items-center gap-5 py-4"
                  >
                    {issue.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={issue.cover.url}
                        alt={issue.cover.alt ?? ""}
                        className="h-20 w-16 shrink-0 border border-border object-cover"
                      />
                    ) : null}
                    <span>
                      <span className="tabular block font-heading text-xl font-semibold">
                        Vol. {issue.volume}, No. {issue.number}
                      </span>
                      {issue.title ? (
                        <span className="block text-muted-foreground">{issue.title}</span>
                      ) : null}
                      <span className="tabular block text-sm text-muted-foreground">
                        {issue.articleCount} {issue.articleCount === 1 ? "article" : "articles"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Container>
    </Section>
  );
}
