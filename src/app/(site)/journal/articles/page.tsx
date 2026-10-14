import Link from "next/link";
import { db } from "@/lib/db";
import { listArticlesPublic } from "@/server/services/journal-articles";
import { ARTICLE_TYPES } from "@/lib/validators/journal";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Articles" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold">Articles</h1>

        <form method="get" className="mt-6 flex flex-wrap gap-2">
          <Input name="q" defaultValue={params.q} placeholder="Search title or keywords" className="max-w-xs" />
          <select name="type" defaultValue={params.type ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Any type</option>
            {ARTICLE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </select>
          <Input name="year" defaultValue={params.year} placeholder="Year" className="w-24" />
          <Button type="submit" variant="outline">Filter</Button>
        </form>

        {articles.length === 0 ? (
          <p className="mt-6 text-muted-foreground">No articles found.</p>
        ) : (
          <ul className="mt-6 divide-y divide-border">
            {articles.map((article) => (
              <li key={article.id} className="py-3">
                <Link href={`/journal/articles/${article.slug}`} className="font-medium text-primary hover:underline">
                  {article.title}
                </Link>
                <p className="text-sm text-muted-foreground">{article.authors.map((a) => a.name).join(", ")}</p>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav className="mt-6 flex gap-2 text-sm" aria-label="Pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/journal/articles?${new URLSearchParams({ ...params, page: String(p) } as Record<string, string>).toString()}`}
                className={p === page ? "font-semibold text-primary" : "text-primary hover:underline"}
              >
                {p}
              </Link>
            ))}
          </nav>
        ) : null}
      </Container>
    </Section>
  );
}
