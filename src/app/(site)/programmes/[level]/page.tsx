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
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">{programme.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{programme.duration}</p>
        <p className="mt-4 text-base text-muted-foreground">{programme.summary}</p>

        <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(programme.body) }} />

        {programme.specialisations.length > 0 ? (
          <div className="mt-10">
            <h2 className="font-heading text-xl font-semibold">Specialisations</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {programme.specialisations.map((spec) => (
                <li key={spec.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">{spec.title}</p>
                  {!isPlaceholder(spec.description) ? (
                    <p className="mt-1 text-sm text-muted-foreground">{spec.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasAdmissionRequirements ? (
          <div className="mt-10">
            <h2 className="font-heading text-xl font-semibold">Admission requirements</h2>
            <Prose
              className="mt-4"
              dangerouslySetInnerHTML={{ __html: renderRichText(programme.admissionRequirements) }}
            />
          </div>
        ) : null}

        {/* Courses block: hidden until Stage 10 links courses to a programme. */}
      </Container>
    </Section>
  );
}
