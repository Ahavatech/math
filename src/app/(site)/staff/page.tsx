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
import { PersonCard } from "@/components/sections/person-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Staff",
  description: "Academic and non-teaching staff of the Department of Mathematics.",
};

type SearchParams = { q?: string; rank?: string; area?: string };

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
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Staff</h1>
        <p className="mt-2 text-muted-foreground">
          Find academic and non-teaching staff in the Department of Mathematics.
        </p>

        <form method="get" className="mt-8 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
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
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="staff-rank" className="sr-only">
              Filter by rank
            </label>
            <select
              id="staff-rank"
              name="rank"
              defaultValue={rank ?? ""}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
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
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All research areas</option>
              {researchAreas.map((area) => (
                <option key={area.id} value={area.slug}>
                  {area.title}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Filter
            </button>
            {hasAnyFilter ? (
              <a href="/staff" className="ml-3 text-sm text-muted-foreground underline">
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
              <div className="mt-10">
                <h2 className="font-heading text-xl font-semibold">Academic staff</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                </div>
              </div>
            ) : null}

            {emeriti.length > 0 ? (
              <div className="mt-10">
                <h2 className="font-heading text-xl font-semibold">Emeriti and former staff</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                </div>
              </div>
            ) : null}

            {nonTeachingStaff.length > 0 && !hasAnyFilter ? (
              <div className="mt-10">
                <h2 className="font-heading text-xl font-semibold">Non-teaching and administrative staff</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {nonTeachingStaff.map((member) => (
                    <Card key={member.id} className="h-full py-4">
                      <CardContent className="flex flex-col items-center gap-3 px-4 text-center">
                        <Avatar className="size-20">
                          {member.photo ? <AvatarImage src={member.photo.url} alt="" /> : null}
                          <AvatarFallback className="font-heading text-lg">
                            {member.name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-heading font-semibold leading-snug">{member.name}</h3>
                          <p className="text-sm text-muted-foreground">{member.position}</p>
                        </div>
                        {member.email || member.phone ? (
                          <div className="text-xs text-muted-foreground">
                            {member.email ? <p>{member.email}</p> : null}
                            {member.phone ? <p>{member.phone}</p> : null}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
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
