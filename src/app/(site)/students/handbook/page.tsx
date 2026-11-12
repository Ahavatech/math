import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { listHandbookTreePublic, searchHandbookPublic } from "@/server/services/handbook";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { fieldControl, fieldButton } from "@/components/ui/field-classes";
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
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Handbook" }]} />
        <PageHeader
          className="mt-4"
          title="Student Handbook"
          description="Policies, regulations and guidance for students, as searchable pages."
          actions={
            handbookDownload ? (
              <a
                href={handbookDownload.fileUrl ?? "#"}
                className="inline-flex min-h-11 items-center bg-primary px-4 text-[0.9375rem] font-medium text-primary-foreground transition-colors hover:bg-foreground"
              >
                Download the handbook PDF
              </a>
            ) : undefined
          }
        />

        <form method="get" role="search" className="mt-6 flex max-w-2xl gap-2">
          <input
            type="search"
            name="q"
            aria-label="Search the handbook"
            defaultValue={q}
            placeholder="Search the handbook"
            className={fieldControl}
          />
          <button type="submit" className={fieldButton}>
            Search
          </button>
        </form>

        {searchResults ? (
          <div className="mt-10 max-w-3xl">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
              Search results
            </h2>
            {searchResults.length === 0 ? (
              <p className="py-5 text-muted-foreground">No pages match &quot;{q}&quot;.</p>
            ) : (
              <ul>
                {searchResults.map((page) => (
                  <li key={page.id} className="index-row border-b border-border">
                    <Link href={`/students/handbook/${page.slug}`} className="block py-4">
                      <span className="block font-heading text-lg font-semibold text-primary">
                        {page.title}
                      </span>
                      {page.summary ? (
                        <span className="block text-muted-foreground">{page.summary}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <nav className="mt-10 max-w-3xl" aria-label="Handbook pages">
            {topLevel.length === 0 ? (
              <EmptyState icon={BookOpen} title="No handbook pages yet" description="Check back soon." />
            ) : (
              <ul className="border-b border-border">
                {topLevel.map((page) => (
                  <li key={page.id} className="border-t border-border">
                    <Link
                      href={`/students/handbook/${page.slug}`}
                      className="index-row flex items-start justify-between gap-4 py-4"
                    >
                      <span>
                        <span className="block font-heading text-xl font-semibold">{page.title}</span>
                        {page.summary ? (
                          <span className="mt-0.5 block text-muted-foreground">{page.summary}</span>
                        ) : null}
                      </span>
                      <ArrowRight className="row-arrow mt-1.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    </Link>
                    {childrenOf(page.id).length > 0 ? (
                      <ul className="mb-4 grid gap-x-8 pl-4 sm:grid-cols-2">
                        {childrenOf(page.id).map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/students/handbook/${child.slug}`}
                              className="link-rule inline-flex min-h-10 items-center text-primary"
                            >
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
