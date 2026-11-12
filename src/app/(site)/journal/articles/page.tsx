import Link from "next/link";
import { db } from "@/lib/db";
import { listArticlesPublic } from "@/server/services/journal-articles";
import { ARTICLE_TYPES } from "@/lib/validators/journal";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { PageNav } from "@/components/ui/filter-links";
import { fieldControl, fieldButton } from "@/components/ui/field-classes";
import { humanise } from "@/lib/labels";

export const revalidate = 300;

export async function generateMetadata() {
  return { title: "Articles" };
}

export default async function JournalArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { articles, total, perPage } = await listArticlesPublic(db, {
    query: params.q,
    year: params.year ? Number(params.year) : undefined,
    type: params.type,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasFilter = Boolean(params.q || params.year || params.type);

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Articles" }]} />
        <PageHeader className="mt-4" title="Articles" />

        <form method="get" role="search" className="mt-6 grid gap-3 sm:grid-cols-[2fr_1fr_8rem_auto]">
          <input
            name="q"
            type="search"
            aria-label="Search title or keywords"
            defaultValue={params.q}
            placeholder="Search title or keywords"
            className={fieldControl}
          />
          <select name="type" aria-label="Article type" defaultValue={params.type ?? ""} className={fieldControl}>
            <option value="">Any type</option>
            {ARTICLE_TYPES.map((t) => (
              <option key={t} value={t}>{humanise(t)}</option>
            ))}
          </select>
          <input
            name="year"
            inputMode="numeric"
            aria-label="Year"
            defaultValue={params.year}
            placeholder="Year"
            className={fieldControl}
          />
          <div className="flex items-center gap-5">
            <button type="submit" className={fieldButton}>
              Filter
            </button>
            {hasFilter ? (
              <Link href="/journal/articles" className="link-rule py-2 font-medium">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {articles.length === 0 ? (
          <p className="mt-8 border-t border-border py-5 text-muted-foreground">No articles found.</p>
        ) : (
          <ul className="mt-8 max-w-4xl">
            {articles.map((article) => (
              <li key={article.id} className="index-row border-t border-border">
                <Link href={`/journal/articles/${article.slug}`} className="block py-5">
                  <span className="block font-heading text-2xl leading-snug font-semibold">
                    {article.title}
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    {article.authors.map((a) => a.name).join(", ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <PageNav
            page={page}
            totalPages={totalPages}
            hrefFor={(target) =>
              `/journal/articles?${new URLSearchParams({ ...params, page: String(target) } as Record<string, string>).toString()}`
            }
          />
        ) : null}
      </Container>
    </Section>
  );
}
