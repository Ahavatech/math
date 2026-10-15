import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listHandbookTreePublic, searchHandbookPublic } from "@/server/services/handbook";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Student Handbook",
};

export default async function HandbookIndexPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim();

  const [tree, handbookDownload, searchResults] = await Promise.all([
    listHandbookTreePublic(db),
    db.download.findFirst({ where: { category: "HANDBOOK", status: "PUBLISHED" } }).catch(() => null),
    q ? searchHandbookPublic(db, q) : Promise.resolve(null),
  ]);

  const topLevel = tree.filter((p) => !p.parentId);
  const childrenOf = (parentId: string) => tree.filter((p) => p.parentId === parentId);

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Handbook" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Student Handbook</h1>

        {handbookDownload ? (
          <a
            href={handbookDownload.fileUrl ?? "#"}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Download the handbook PDF
          </a>
        ) : null}

        <form method="get" className="mt-6 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search the handbook"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <button type="submit" className="h-9 rounded-md border border-input px-3 text-sm">Search</button>
        </form>

        {searchResults ? (
          <div className="mt-6 space-y-3">
            <h2 className="font-heading text-lg font-semibold">Search results</h2>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pages match &quot;{q}&quot;.</p>
            ) : (
              <ul className="space-y-2">
                {searchResults.map((page) => (
                  <li key={page.id}>
                    <Link href={`/students/handbook/${page.slug}`} className="font-medium text-primary hover:underline">
                      {page.title}
                    </Link>
                    {page.summary ? <p className="text-sm text-muted-foreground">{page.summary}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <nav className="mt-8" aria-label="Handbook pages">
            {topLevel.length === 0 ? (
              <EmptyState icon={BookOpen} title="No handbook pages yet" description="Check back soon." />
            ) : (
              <ul className="space-y-3">
                {topLevel.map((page) => (
                  <li key={page.id}>
                    <Link href={`/students/handbook/${page.slug}`} className="font-medium text-primary hover:underline">
                      {page.title}
                    </Link>
                    {page.summary ? <p className="text-sm text-muted-foreground">{page.summary}</p> : null}
                    {childrenOf(page.id).length > 0 ? (
                      <ul className="mt-1 ml-4 space-y-1 border-l border-border pl-3">
                        {childrenOf(page.id).map((child) => (
                          <li key={child.id}>
                            <Link href={`/students/handbook/${child.slug}`} className="text-sm text-primary hover:underline">
                              {child.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </nav>
        )}
      </Container>
    </Section>
  );
}
