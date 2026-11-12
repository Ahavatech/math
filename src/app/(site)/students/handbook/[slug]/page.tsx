import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  getHandbookPageBySlugPublic,
  findHandbookPageBySlugOrPrevious,
  listHandbookTreePublic,
} from "@/server/services/handbook";
import { renderRichText } from "@/lib/sanitize-html";
import { addHeadingIds, extractTableOfContents } from "@/lib/toc";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getHandbookPageBySlugPublic(db, slug);
  return { title: page?.title ?? "Handbook" };
}

export default async function HandbookPageDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const lookup = await findHandbookPageBySlugOrPrevious(db, slug);
  if (!lookup) notFound();
  if (lookup.redirectTo) redirect(`/students/handbook/${lookup.redirectTo}`);
  if (lookup.page.status !== "PUBLISHED") notFound();

  const [page, tree] = await Promise.all([getHandbookPageBySlugPublic(db, slug), listHandbookTreePublic(db)]);
  if (!page) notFound();

  const plainRenderedBody = renderRichText(page.body);
  const toc = extractTableOfContents(plainRenderedBody);
  const renderedBody = addHeadingIds(plainRenderedBody);

  const siblings = tree.filter((p) => p.parentId === page.parentId).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((p) => p.id === page.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  const parent = page.parentId ? tree.find((p) => p.id === page.parentId) : null;

  return (
    <Section>
      <Container className="max-w-5xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Students", href: "/students" },
            { label: "Handbook", href: "/students/handbook" },
            ...(parent ? [{ label: parent.title, href: `/students/handbook/${parent.slug}` }] : []),
            { label: page.title },
          ]}
        />

        <details className="mt-6 border border-foreground p-3 lg:hidden print:hidden">
          <summary className="cursor-pointer py-1 font-medium">Handbook pages</summary>
          <div className="mt-3">
            <HandbookSidebarTree tree={tree} currentSlug={page.slug} />
          </div>
        </details>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_240px]">
          <article className="min-w-0">
            <h1 className="border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl">{page.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground print:hidden">
              Last updated {page.updatedAt.toLocaleDateString()}
            </p>

            {toc.length > 0 ? (
              <nav className="mt-6 border-t-2 border-foreground bg-secondary/60 p-4 print:hidden" aria-label="Table of contents">
                <p className="font-heading text-lg font-semibold">On this page</p>
                <ul className="mt-2">
                  {toc.map((entry) => (
                    <li key={entry.id} className={entry.level === 3 ? "ml-4" : undefined}>
                      <a href={`#${entry.id}`} className="link-rule inline-block py-1.5 text-primary">
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderedBody }} />

            <nav className="mt-12 flex justify-between gap-4 border-t-2 border-foreground pt-4 print:hidden" aria-label="Page navigation">
              {previous ? (
                <Link href={`/students/handbook/${previous.slug}`} className="link-rule py-2 font-medium text-primary">
                  Previous: {previous.title}
                </Link>
              ) : <span />}
              {next ? (
                <Link href={`/students/handbook/${next.slug}`} className="link-rule py-2 font-medium text-primary">
                  Next: {next.title}
                </Link>
              ) : null}
            </nav>
          </article>

          <aside className="hidden lg:block print:hidden">
            <HandbookSidebarTree tree={tree} currentSlug={page.slug} />
          </aside>
        </div>
      </Container>
    </Section>
  );
}

function HandbookSidebarTree({ tree, currentSlug }: { tree: Awaited<ReturnType<typeof listHandbookTreePublic>>; currentSlug: string }) {
  const topLevel = tree.filter((p) => !p.parentId);
  const childrenOf = (parentId: string) => tree.filter((p) => p.parentId === parentId);

  return (
    <nav className="sticky top-24 space-y-1" aria-label="Handbook pages">
      {topLevel.map((page) => (
        <div key={page.id}>
          <Link
            href={`/students/handbook/${page.slug}`}
            className={page.slug === currentSlug ? "inline-flex min-h-10 items-center font-semibold text-accent" : "inline-flex min-h-10 items-center hover:text-accent"}
          >
            {page.title}
          </Link>
          {childrenOf(page.id).length > 0 ? (
            <ul className="ml-3 border-l border-border pl-3">
              {childrenOf(page.id).map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/students/handbook/${child.slug}`}
                    className={child.slug === currentSlug ? "inline-flex min-h-9 items-center font-semibold text-accent" : "inline-flex min-h-9 items-center text-muted-foreground hover:text-accent"}
                  >
                    {child.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
