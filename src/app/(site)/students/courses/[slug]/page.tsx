import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCourseBySlugPublic } from "@/server/services/courses";
import { renderRichText } from "@/lib/sanitize-html";
import { enumToLevelSlug } from "@/lib/programme-level";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlugPublic(db, slug);
  return { title: course ? `${course.code} - ${course.title}` : "Course" };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlugPublic(db, slug);
  if (!course) notFound();

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Students", href: "/students" },
            { label: "Courses", href: "/students/courses" },
            { label: course.code },
          ]}
        />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">{course.code}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{course.title}</p>

        <dl className="mt-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
          <div><dt className="inline font-medium text-foreground">Units: </dt><dd className="inline">{course.units}</dd></div>
          <div><dt className="inline font-medium text-foreground">Level: </dt><dd className="inline">{course.level}</dd></div>
          <div><dt className="inline font-medium text-foreground">Semester: </dt><dd className="inline">{course.semester === "FIRST" ? "First" : "Second"}</dd></div>
          {course.isElective ? <div>Elective</div> : null}
        </dl>

        <Link href={`/programmes/${enumToLevelSlug(course.programmeLevel)}`} className="mt-2 inline-block text-sm text-primary underline">
          Part of the {course.programmeLevel} programme
        </Link>

        {course.description ? (
          <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(course.description) }} />
        ) : null}

        {course.prerequisites.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-heading text-lg font-semibold">Prerequisites</h2>
            <ul className="mt-2 space-y-1">
              {course.prerequisites.map((p) => (
                <li key={p.id}>
                  <Link href={`/students/courses/${p.slug}`} className="text-primary hover:underline">
                    {p.code} - {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {course.requiredFor.length > 0 ? (
          <div className="mt-6">
            <h2 className="font-heading text-lg font-semibold">Required for</h2>
            <ul className="mt-2 space-y-1">
              {course.requiredFor.map((p) => (
                <li key={p.id}>
                  <Link href={`/students/courses/${p.slug}`} className="text-primary hover:underline">
                    {p.code} - {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {course.lecturers.length > 0 ? (
          <div className="mt-6">
            <h2 className="font-heading text-lg font-semibold">Lecturers</h2>
            <ul className="mt-2 space-y-1">
              {course.lecturers.map((l) => (
                <li key={l.id}>
                  <Link href={`/lecturer/${l.slug}`} className="text-primary hover:underline">
                    {l.fullName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
