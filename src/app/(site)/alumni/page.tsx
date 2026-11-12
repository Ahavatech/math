import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listApprovedAlumni, listFeaturedAlumni, countApprovedAlumni } from "@/server/services/alumni-public";
import { COUNTRIES } from "@/lib/countries";
import { INDUSTRIES } from "@/lib/industries";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { PageNav } from "@/components/ui/filter-links";
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
  const yearNum = params.year ? Number(params.year) : NaN;
  const year = Number.isInteger(yearNum) && yearNum >= 1960 && yearNum <= 2100 ? yearNum : undefined;
  const level = params.level === "BSC" || params.level === "MSC" || params.level === "PHD" ? params.level : undefined;
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
        <PageHeader
          className="mt-4"
          title="Alumni"
          description={`${approvedCount} alumni have joined the directory so far.`}
        />

        {featured.length > 0 ? (
          <div className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Where are they now</h2>
            <div className="grid gap-x-10 sm:grid-cols-3">
              {featured.map((entry) => (
                <AlumniCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        ) : null}

        <form method="get" role="search" className="mt-10 grid gap-3 sm:grid-cols-4">
          <input type="search" name="q" aria-label="Search by name" defaultValue={params.q} placeholder="Search by name" className="h-12 w-full border border-input bg-background px-3 text-base sm:col-span-2" />
          <input type="number" name="year" aria-label="Graduation year" defaultValue={params.year} placeholder="Graduation year" className="h-12 w-full border border-input bg-background px-3 text-base" />
          <select name="level" aria-label="Programme" defaultValue={params.level ?? ""} className="h-12 w-full border border-input bg-background px-3 text-base">
            <option value="">Any programme</option>
            <option value="BSC">B.Sc.</option>
            <option value="MSC">M.Sc.</option>
            <option value="PHD">Ph.D.</option>
          </select>
          <select name="country" aria-label="Country" defaultValue={params.country ?? ""} className="h-12 w-full border border-input bg-background px-3 text-base sm:col-span-2">
            <option value="">Any country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="industry" aria-label="Industry" defaultValue={params.industry ?? ""} className="h-12 w-full border border-input bg-background px-3 text-base sm:col-span-2">
            <option value="">Any industry</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
          <div className="flex items-center gap-5 sm:col-span-4">
            <button
              type="submit"
              className="h-12 bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground"
            >
              Filter
            </button>
            {hasAnyFilter ? (
              <Link href="/alumni" className="link-rule py-2 font-medium">
                Clear filters
              </Link>
            ) : null}
          </div>
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
          <div className="mt-6 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <AlumniCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <PageNav
            page={page}
            totalPages={totalPages}
            hrefFor={(target) => query({ page: String(target) })}
          />
        ) : null}

        <div className="mt-16 border-t-2 border-foreground pt-6">
          <h2 className="font-heading text-2xl font-semibold">Are you an alumnus?</h2>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">
            The department sends alumni a private link to update their details. If you have not received one,
            get in touch.
          </p>
          <Link href="/contact?type=ALUMNI" className="link-rule mt-3 inline-block py-2 font-medium text-primary">
            Contact the department
          </Link>
        </div>
      </Container>
    </Section>
  );
}
