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
import { safeJsonLdString, buildCourseJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";

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

  const jsonLd = buildCourseJsonLd({
    title: course.title,
    code: course.code,
    slug: course.slug,
    description: course.description || null,
    siteUrl: SITE_URL,
  });

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
        <h1 className="tabular mt-4 font-heading text-5xl leading-[1.05] font-semibold">{course.code}</h1>
        <p className="mt-2 border-b-2 border-foreground pb-5 font-heading text-2xl text-muted-foreground">{course.title}</p>

        <dl className="tabular mt-0 grid grid-cols-2 border-b border-border sm:grid-cols-4">
          <div className="border-r border-border py-3 pr-4"><dt className="text-sm text-muted-foreground">Units</dt><dd className="text-xl font-semibold">{course.units}</dd></div>
          <div className="border-r border-border px-4 py-3 sm:border-r"><dt className="text-sm text-muted-foreground">Level</dt><dd className="text-xl font-semibold">{course.level}</dd></div>
          <div className="border-r border-border py-3 pr-4 sm:px-4"><dt className="text-sm text-muted-foreground">Semester</dt><dd className="text-xl font-semibold">{course.semester === "FIRST" ? "First" : "Second"}</dd></div>
          <div className="px-4 py-3"><dt className="text-sm text-muted-foreground">Type</dt><dd className="text-xl font-semibold">{course.isElective ? "Elective" : "Core"}</dd></div>
        </dl>

        <Link href={`/programmes/${enumToLevelSlug(course.programmeLevel)}`} className="link-rule mt-3 inline-block py-2 font-medium text-primary">
          Part of the {course.programmeLevel} programme
        </Link>

        {course.description ? (
          <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(course.description) }} />
        ) : null}

        {course.prerequisites.length > 0 ? (
          <div className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Prerequisites</h2>
            <ul>
              {course.prerequisites.map((p) => (
                <li key={p.id} className="index-row border-b border-border">
                  <Link href={`/students/courses/${p.slug}`} className="flex min-h-14 items-baseline gap-4 py-3">
                    <span className="tabular font-semibold text-primary">{p.code}</span>
                    <span className="text-muted-foreground">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {course.requiredFor.length > 0 ? (
          <div className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Required for</h2>
            <ul>
              {course.requiredFor.map((p) => (
                <li key={p.id} className="index-row border-b border-border">
                  <Link href={`/students/courses/${p.slug}`} className="flex min-h-14 items-baseline gap-4 py-3">
                    <span className="tabular font-semibold text-primary">{p.code}</span>
                    <span className="text-muted-foreground">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {course.lecturers.length > 0 ? (
          <div className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Lecturers</h2>
            <ul>
              {course.lecturers.map((l) => (
                <li key={l.id} className="index-row border-b border-border">
                  <Link href={`/lecturer/${l.slug}`} className="flex min-h-14 items-center py-3 font-medium text-primary">
                    {l.fullName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />
    </Section>
  );
}
