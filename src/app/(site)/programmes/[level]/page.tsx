import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { renderRichText } from "@/lib/sanitize-html";
import { isPlaceholder } from "@/lib/placeholder";
import { levelSlugToEnum } from "@/lib/programme-level";
import { listCoursesPublic } from "@/server/services/courses";
import Link from "next/link";

async function getProgramme(levelSlug: string) {
  const level = levelSlugToEnum(levelSlug);
  if (!level) return null;
  try {
    return await db.programme.findFirst({
      where: { level, status: "PUBLISHED" },
      include: { specialisations: { where: { isActive: true }, orderBy: { order: "asc" } } },
    });
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const programmes = await db.programme.findMany({ where: { status: "PUBLISHED" }, select: { level: true } });
    return programmes.map((p) => ({ level: p.level.toLowerCase() }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ level: string }>;
}): Promise<Metadata> {
  const { level } = await params;
  const programme = await getProgramme(level);
  if (!programme) return {};
  return { title: programme.title, description: programme.summary };
}

export default async function ProgrammeLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level: levelSlug } = await params;
  const programme = await getProgramme(levelSlug);
  if (!programme) notFound();

  const hasAdmissionRequirements = !isPlaceholder(programme.admissionRequirements);
  const { courses } = await listCoursesPublic(db, { programmeLevel: programme.level });

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Programmes", href: "/programmes" },
            { label: programme.title },
          ]}
        />
        <h1 className="mt-4 border-b-2 border-foreground pb-5 font-heading text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl">
          {programme.title}
        </h1>
        <p className="tabular mt-4 font-medium text-accent">{programme.duration}</p>
        <p className="mt-3 max-w-[60ch] text-xl leading-relaxed text-muted-foreground">{programme.summary}</p>

        <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(programme.body) }} />

        {programme.specialisations.length > 0 ? (
          <div className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Specialisations</h2>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {programme.specialisations.map((spec) => (
                <li key={spec.id} className="border-b border-border py-3.5">
                  <p className="font-heading text-lg font-semibold">{spec.title}</p>
                  {!isPlaceholder(spec.description) ? (
                    <p className="mt-1 text-muted-foreground">{spec.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasAdmissionRequirements ? (
          <div className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Admission requirements</h2>
            <Prose
              className="mt-4"
              dangerouslySetInnerHTML={{ __html: renderRichText(programme.admissionRequirements) }}
            />
          </div>
        ) : null}

        {courses.length > 0 ? (
          <div className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">Courses</h2>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {courses.map((course) => (
                <li key={course.id} className="index-row border-b border-border">
                  <Link href={`/students/courses/${course.slug}`} className="flex min-h-14 items-baseline gap-4 py-3">
                    <span className="tabular font-semibold text-primary">{course.code}</span>
                    <span className="text-muted-foreground">{course.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/students/courses" className="link-rule mt-4 inline-block py-2 font-medium text-primary">
              View the full course catalogue
            </Link>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
