import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { siteSearch, validateSearchQuery } from "@/server/services/site-search";
import type { SearchResultType } from "@/server/services/site-search";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { InMemoryRateLimiter } from "@/lib/rate-limit";
import { formatDateWAT } from "@/lib/time";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

// Per-IP: 30 searches per minute
const searchLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

const TYPE_LABELS: Record<SearchResultType, string> = {
  news: "News",
  event: "Events",
  lecturer: "Lecturers",
  staff: "Staff",
  programme: "Programmes",
  research: "Research",
  course: "Courses",
  handbook: "Handbook",
  download: "Downloads",
  calendar: "Calendar",
  journal_issue: "Journal Issues",
  article: "Journal Articles",
};

const ALL_TYPES = Object.keys(TYPE_LABELS) as SearchResultType[];

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const rawQ = typeof params.q === "string" ? params.q : "";
  const typeParam = typeof params.type === "string" ? (params.type as SearchResultType) : undefined;
  const rawPage = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const selectedType = typeParam && ALL_TYPES.includes(typeParam) ? typeParam : undefined;

  // Rate-limit by IP
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";
  const rl = searchLimiter.check(ip);

  const q = validateSearchQuery(rawQ);
  const tooShort = rawQ.trim().length > 0 && q === null && rawQ.trim().length < 2;

  let data = { results: [] as Awaited<ReturnType<typeof siteSearch>>["results"], total: 0, page: 1, perPage: 20, query: rawQ };

  if (q && rl.allowed) {
    data = await siteSearch(db, q, { page, type: selectedType });
  }

  const totalPages = Math.ceil(data.total / data.perPage);

  function buildUrl(overrides: Record<string, string | number | undefined>) {
    const merged = { q: rawQ, type: selectedType, page, ...overrides };
    const parts: string[] = [];
    if (merged.q) parts.push(`q=${encodeURIComponent(String(merged.q))}`);
    if (merged.type) parts.push(`type=${encodeURIComponent(String(merged.type))}`);
    if (merged.page && Number(merged.page) > 1) parts.push(`page=${merged.page}`);
    return `/search${parts.length ? `?${parts.join("&")}` : ""}`;
  }

  return (
    <main>
      <Section>
        <Container>
          <Breadcrumbs items={[{ label: "Search" }]} />
          <h1 className="text-2xl font-bold mt-4 mb-6">Search</h1>

          {/* Search form */}
          <form role="search" action="/search" method="GET" className="mb-8">
            <label htmlFor="search-input" className="sr-only">
              Search the department website
            </label>
            <div className="flex gap-2 max-w-xl">
              <input
                id="search-input"
                name="q"
                type="search"
                defaultValue={rawQ}
                placeholder="Search..."
                minLength={2}
                maxLength={100}
                autoComplete="off"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Search query"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Search size={16} aria-hidden="true" />
                Search
              </button>
            </div>
            {tooShort && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                Please enter at least 2 characters.
              </p>
            )}
          </form>

          {/* Type filter */}
          {q && data.total > 0 && (
            <nav aria-label="Filter by type" className="flex flex-wrap gap-2 mb-6">
              <Link
                href={buildUrl({ type: undefined, page: 1 })}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  !selectedType
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                All ({data.total})
              </Link>
              {ALL_TYPES.filter((t) => data.results.some((r) => r.type === t)).map((t) => (
                <Link
                  key={t}
                  href={buildUrl({ type: t, page: 1 })}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    selectedType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </Link>
              ))}
            </nav>
          )}

          {/* Rate limited */}
          {!rl.allowed && (
            <p className="text-sm text-muted-foreground" role="status">
              Too many searches. Please wait a moment and try again.
            </p>
          )}

          {/* Results */}
          {q && rl.allowed && (
            <>
              <p className="text-sm text-muted-foreground mb-4" role="status" aria-live="polite">
                {data.total === 0
                  ? `No results for "${q}"`
                  : `${data.total} result${data.total === 1 ? "" : "s"} for "${q}"`}
              </p>

              {data.results.length > 0 && (
                <ul role="list" className="space-y-6" aria-label="Search results">
                  {data.results.map((result) => (
                    <li key={`${result.type}-${result.id}`}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground shrink-0">
                          {TYPE_LABELS[result.type]}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={result.url}
                            className="font-medium text-foreground hover:underline line-clamp-1"
                          >
                            {result.title}
                          </Link>
                          {result.snippet && (
                            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                              {result.snippet}
                            </p>
                          )}
                          {result.date && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDateWAT(result.date)}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <nav aria-label="Pagination" className="mt-8 flex items-center gap-2">
                  {page > 1 && (
                    <Link
                      href={buildUrl({ page: page - 1 })}
                      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Previous
                    </Link>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={buildUrl({ page: page + 1 })}
                      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Next
                    </Link>
                  )}
                </nav>
              )}

              {/* No-results suggestions */}
              {data.total === 0 && (
                <div className="mt-4 text-sm text-muted-foreground space-y-1">
                  <p>Suggestions:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Check your spelling</li>
                    <li>Try fewer or more general keywords</li>
                    <li>
                      Browse{" "}
                      <Link href="/news" className="underline">
                        News
                      </Link>
                      ,{" "}
                      <Link href="/events" className="underline">
                        Events
                      </Link>
                      , or{" "}
                      <Link href="/programmes" className="underline">
                        Programmes
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}

          {!q && !tooShort && (
            <p className="text-sm text-muted-foreground">Enter a search term above to get started.</p>
          )}
        </Container>
      </Section>
    </main>
  );
}
