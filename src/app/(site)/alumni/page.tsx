import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listApprovedAlumni, listFeaturedAlumni, countApprovedAlumni } from "@/server/services/alumni-public";
import { COUNTRIES } from "@/lib/countries";
import { INDUSTRIES } from "@/lib/industries";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { AlumniCard } from "./alumni-card";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Alumni",
  description: "Where our graduates are now, and how to join the directory.",
};

type SearchParams = { page?: string; year?: string; level?: string; country?: string; industry?: string; q?: string };

export default async function AlumniPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const year = params.year ? Number(params.year) : undefined;
  const level = params.level === "BSC" || params.level === "MSC" ? params.level : undefined;
  const country = params.country || undefined;
  const industry = params.industry || undefined;
  const q = params.q?.trim() || undefined;

  const [{ entries, total }, featured, approvedCount] = await Promise.all([
    listApprovedAlumni(db, { page, year, level, country, industry, q }),
    listFeaturedAlumni(db, 3),
    countApprovedAlumni(db),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / 24));
  const hasAnyFilter = Boolean(params.year || params.level || params.country || params.industry || params.q);
  const query = (overrides: Record<string, string | undefined>) => {
    const next = { ...params, ...overrides };
    const search = Object.entries(next)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return `/alumni${search ? `?${search}` : ""}`;
  };

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Alumni" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Alumni</h1>
        <p className="mt-2 text-muted-foreground">{approvedCount} alumni have joined the directory so far.</p>

        {featured.length > 0 ? (
          <div className="mt-8 rounded-lg border border-border bg-muted p-4">
            <h2 className="font-heading text-lg font-semibold">Where are they now</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {featured.map((entry) => (
                <AlumniCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        ) : null}

        <form method="get" className="mt-8 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-5">
          <input type="search" name="q" defaultValue={params.q} placeholder="Search by name" className="h-9 rounded-md border border-input bg-background px-3 text-sm sm:col-span-2" />
          <input type="number" name="year" defaultValue={params.year} placeholder="Graduation year" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          <select name="level" defaultValue={params.level ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Any level</option>
            <option value="BSC">B.Sc.</option>
            <option value="MSC">M.Sc.</option>
          </select>
          <select name="country" defaultValue={params.country ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Any country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="industry" defaultValue={params.industry ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm sm:col-span-2">
            <option value="">Any industry</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-md border border-input bg-primary px-3 text-sm text-primary-foreground">
            Filter
          </button>
        </form>

        {entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasAnyFilter ? "No alumni match these filters" : "No alumni yet"}
            description={
              hasAnyFilter
                ? "Try a different search or clear the filters."
                : "Approved alumni will appear here once the department reviews their entries."
            }
            className="mt-10"
          />
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {entries.map((entry) => (
              <AlumniCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="mt-10 flex justify-center gap-4 text-sm" aria-label="Pagination">
            {page > 1 ? (
              <Link href={query({ page: String(page - 1) })} className="underline">
                Previous
              </Link>
            ) : null}
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={query({ page: String(page + 1) })} className="underline">
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}

        <div className="mt-12 rounded-lg border border-dashed border-border p-6 text-center">
          <h2 className="font-heading text-lg font-semibold">Are you an alumnus?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The department sends alumni a private link to update their details. If you have not received one,
            get in touch.
          </p>
          <Link href="/contact?type=ALUMNI" className="mt-3 inline-block text-sm text-primary underline">
            Contact the department
          </Link>
        </div>
      </Container>
    </Section>
  );
}
