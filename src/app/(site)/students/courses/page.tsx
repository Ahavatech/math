import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listCoursesPublic } from "@/server/services/courses";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
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

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Courses" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Course Catalogue</h1>

        <form method="get" className="mt-6 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4 print:hidden">
          <input type="search" name="q" defaultValue={params.q} placeholder="Search by code or title" className="h-9 rounded-md border border-input bg-background px-3 text-sm sm:col-span-2" />
          <select name="programmeLevel" defaultValue={params.programmeLevel ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Any programme</option>
            <option value="BSC">B.Sc.</option>
            <option value="MSC">M.Sc.</option>
            <option value="PHD">Ph.D.</option>
          </select>
          <select name="semester" defaultValue={params.semester ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Any semester</option>
            <option value="FIRST">First</option>
            <option value="SECOND">Second</option>
          </select>
          <button type="submit" className="h-9 rounded-md border border-input px-3 text-sm sm:col-span-4">Filter</button>
        </form>

        {courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses match" description="Try a different search or clear the filters." className="mt-10" />
        ) : (
          <div className="mt-8 space-y-8">
            {levels.map((level) => (
              <div key={level}>
                <h2 className="font-heading text-xl font-semibold">{level} level</h2>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Title</th>
                      <th className="py-2 pr-4">Units</th>
                      <th className="py-2 pr-4">Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.filter((c) => c.level === level).map((course) => (
                      <tr key={course.id} className="border-b border-border">
                        <td className="py-2 pr-4">
                          <Link href={`/students/courses/${course.slug}`} className="font-medium text-primary hover:underline">
                            {course.code}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{course.title}{course.isElective ? " (elective)" : ""}</td>
                        <td className="py-2 pr-4">{course.units}</td>
                        <td className="py-2 pr-4">{course.semester === "FIRST" ? "First" : "Second"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
