import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listCoursesPublic } from "@/server/services/courses";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { fieldControl, fieldButton } from "@/components/ui/field-classes";
import { BookOpen } from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Course Catalogue",
};

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ programmeLevel?: string; level?: string; semester?: string; q?: string }>;
}) {
  const params = await searchParams;
  const programmeLevel = ["BSC", "MSC", "PHD"].includes(params.programmeLevel ?? "") ? (params.programmeLevel as "BSC" | "MSC" | "PHD") : undefined;
  const semester = params.semester === "FIRST" || params.semester === "SECOND" ? params.semester : undefined;
  const level = params.level ? Number(params.level) : undefined;

  const { courses } = await listCoursesPublic(db, { programmeLevel, semester, level, q: params.q });
  const levels = [...new Set(courses.map((c) => c.level))].sort((a, b) => a - b);
  const hasFilter = Boolean(params.q || programmeLevel || semester);

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Courses" }]} />
        <PageHeader
          className="mt-4"
          title="Course Catalogue"
          description="Course codes, titles, units and semesters. Open a course for its description and prerequisites."
        />

        <form method="get" role="search" className="mt-6 grid gap-3 sm:grid-cols-4 print:hidden">
          <input
            type="search"
            name="q"
            aria-label="Search by code or title"
            defaultValue={params.q}
            placeholder="Search by code or title"
            className={`${fieldControl} sm:col-span-2`}
          />
          <select name="programmeLevel" aria-label="Programme" defaultValue={params.programmeLevel ?? ""} className={fieldControl}>
            <option value="">Any programme</option>
            <option value="BSC">B.Sc.</option>
            <option value="MSC">M.Sc.</option>
            <option value="PHD">Ph.D.</option>
          </select>
          <select name="semester" aria-label="Semester" defaultValue={params.semester ?? ""} className={fieldControl}>
            <option value="">Any semester</option>
            <option value="FIRST">First</option>
            <option value="SECOND">Second</option>
          </select>
          <div className="flex items-center gap-5 sm:col-span-4">
            <button type="submit" className={fieldButton}>
              Filter
            </button>
            {hasFilter ? (
              <Link href="/students/courses" className="link-rule py-2 font-medium">
                Clear filters
              </Link>
            ) : null}
          </div>
        </form>

        {courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses match" description="Try a different search or clear the filters." className="mt-10" />
        ) : (
          <div className="mt-10 space-y-12">
            {levels.map((level) => (
              <section key={level} aria-labelledby={`level-${level}`}>
                <h2
                  id={`level-${level}`}
                  className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold"
                >
                  {level} level
                </h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-sm text-muted-foreground">
                      <th scope="col" className="w-28 py-2.5 pr-4 font-medium">Code</th>
                      <th scope="col" className="py-2.5 pr-4 font-medium">Title</th>
                      <th scope="col" className="hidden w-20 py-2.5 pr-4 font-medium sm:table-cell">Units</th>
                      <th scope="col" className="hidden w-28 py-2.5 font-medium sm:table-cell">Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.filter((c) => c.level === level).map((course) => (
                      <tr key={course.id} className="border-b border-border align-top">
                        <td className="py-3.5 pr-4">
                          <Link href={`/students/courses/${course.slug}`} className="link-rule font-semibold text-primary">
                            {course.code}
                          </Link>
                        </td>
                        <td className="py-3.5 pr-4">
                          {course.title}
                          {course.isElective ? " (elective)" : ""}
                          <span className="tabular mt-0.5 block text-sm text-muted-foreground sm:hidden">
                            {course.units} {course.units === 1 ? "unit" : "units"}, {course.semester === "FIRST" ? "first" : "second"} semester
                          </span>
                        </td>
                        <td className="tabular hidden py-3.5 pr-4 sm:table-cell">{course.units}</td>
                        <td className="hidden py-3.5 sm:table-cell">{course.semester === "FIRST" ? "First" : "Second"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
