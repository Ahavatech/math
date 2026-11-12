import type { Metadata } from "next";
import { LecturerRank } from "@prisma/client";
import { db } from "@/lib/db";
import { listLecturersDirectory } from "@/server/services/lecturers";
import { listNonTeachingStaffPublic } from "@/server/services/non-teaching-staff";
import { listResearchAreasPublic } from "@/server/services/research-areas";
import { rankLabel } from "@/lib/lecturer-rank";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { PersonCard } from "@/components/sections/person-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Staff",
  description: "Academic and non-teaching staff of the Department of Mathematics.",
};

type SearchParams = { q?: string; rank?: string; area?: string };

const control = "h-12 w-full border border-input bg-background px-3 text-base";

function isLecturerRank(value: string | undefined): value is LecturerRank {
  return Boolean(value) && Object.values(LecturerRank).includes(value as LecturerRank);
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const rank = isLecturerRank(params.rank) ? params.rank : undefined;
  const researchAreaSlug = params.area || undefined;

  const [lecturers, nonTeachingStaff, researchAreas] = await Promise.all([
    listLecturersDirectory(db, { search, rank, researchAreaSlug }),
    listNonTeachingStaffPublic(db),
    listResearchAreasPublic(db),
  ]);

  const academicStaff = lecturers.filter((l) => !l.isEmeritus);
  const emeriti = lecturers.filter((l) => l.isEmeritus);
  const hasAnyFilter = Boolean(search || rank || researchAreaSlug);
  const nothingAtAll = lecturers.length === 0 && nonTeachingStaff.length === 0;

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Staff" }]} />
        <PageHeader
          className="mt-4"
          title="Staff"
          description="Find academic and non-teaching staff in the Department of Mathematics."
        />

        <form method="get" role="search" className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="staff-search" className="sr-only">
              Search by name
            </label>
            <input
              id="staff-search"
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search by name"
              className={control}
            />
          </div>
          <div>
            <label htmlFor="staff-rank" className="sr-only">
              Filter by rank
            </label>
            <select id="staff-rank" name="rank" defaultValue={rank ?? ""} className={control}>
              <option value="">All ranks</option>
              {Object.values(LecturerRank).map((r) => (
                <option key={r} value={r}>
                  {rankLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="staff-area" className="sr-only">
              Filter by research area
            </label>
            <select
              id="staff-area"
              name="area"
              defaultValue={researchAreaSlug ?? ""}
              className={control}
            >
              <option value="">All research areas</option>
              {researchAreas.map((area) => (
                <option key={area.id} value={area.slug}>
                  {area.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-5 sm:col-span-4">
            <button
              type="submit"
              className="h-12 bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground"
            >
              Filter
            </button>
            {hasAnyFilter ? (
              <a href="/staff" className="link-rule py-2 font-medium">
                Clear filters
              </a>
            ) : null}
          </div>
        </form>

        {nothingAtAll && !hasAnyFilter ? (
          <EmptyState
            icon={Users}
            title="No staff profiles yet"
            description="Staff profiles will appear here once they are published."
            className="mt-10"
          />
        ) : (
          <>
            {academicStaff.length > 0 ? (
              <StaffGroup title="Academic staff">
                {academicStaff.map((lecturer) => (
                  <PersonCard
                    key={lecturer.id}
                    name={[lecturer.honorific, lecturer.fullName].filter(Boolean).join(" ")}
                    rank={rankLabel(lecturer.rank)}
                    photoUrl={lecturer.photo?.url}
                    href={`/lecturer/${lecturer.slug}`}
                    researchAreas={lecturer.researchAreas.map((a) => a.title)}
                  />
                ))}
              </StaffGroup>
            ) : null}

            {emeriti.length > 0 ? (
              <StaffGroup title="Emeriti and former staff">
                {emeriti.map((lecturer) => (
                  <PersonCard
                    key={lecturer.id}
                    name={[lecturer.honorific, lecturer.fullName].filter(Boolean).join(" ")}
                    rank={rankLabel(lecturer.rank)}
                    photoUrl={lecturer.photo?.url}
                    href={`/lecturer/${lecturer.slug}`}
                    researchAreas={lecturer.researchAreas.map((a) => a.title)}
                  />
                ))}
              </StaffGroup>
            ) : null}

            {nonTeachingStaff.length > 0 && !hasAnyFilter ? (
              <StaffGroup title="Non-teaching and administrative staff">
                {nonTeachingStaff.map((member) => (
                  <article
                    key={member.id}
                    className="flex h-full gap-4 border-t border-border py-4"
                  >
                    <Avatar className="size-16 shrink-0 rounded-none after:rounded-none">
                      {member.photo ? (
                        <AvatarImage src={member.photo.url} alt="" className="rounded-none" />
                      ) : null}
                      <AvatarFallback className="rounded-none bg-secondary font-heading text-lg">
                        {member.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-heading text-lg leading-snug font-semibold">
                        {member.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{member.position}</p>
                      {member.email ? (
                        <p className="mt-1 text-sm">
                          <a href={`mailto:${member.email}`} className="link-rule">
                            {member.email}
                          </a>
                        </p>
                      ) : null}
                      {member.phone ? (
                        <p className="tabular text-sm text-muted-foreground">{member.phone}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </StaffGroup>
            ) : null}

            {academicStaff.length === 0 && emeriti.length === 0 && hasAnyFilter ? (
              <EmptyState
                icon={Users}
                title="No staff match those filters"
                description="Try a different name, rank or research area."
                className="mt-10"
              />
            ) : null}
          </>
        )}
      </Container>
    </Section>
  );
}

function StaffGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-12">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      <div className="mt-3 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}
