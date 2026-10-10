import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  getResearchAreaBySlugPublic,
  getResearchAreaStatusBySlug,
  listResearchAreasPublic,
} from "@/server/services/research-areas";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { CloudImage } from "@/components/ui/cloud-image";
import { PersonCard } from "@/components/sections/person-card";
import { renderRichText } from "@/lib/sanitize-html";
import { rankLabel } from "@/lib/lecturer-rank";

export async function generateStaticParams() {
  try {
    const areas = await listResearchAreasPublic(db);
    return areas.map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = await getResearchAreaBySlugPublic(db, slug);
  if (!area) return {};
  return {
    title: area.title,
    description: area.summary,
    openGraph: area.image ? { images: [{ url: area.image.url }] } : undefined,
  };
}

export default async function ResearchAreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = await getResearchAreaBySlugPublic(db, slug);

  if (!area) {
    const status = await getResearchAreaStatusBySlug(db, slug);
    if (status === "ARCHIVED") redirect("/research");
    notFound();
  }

  const lecturerIds = area.lecturers.map((l) => l.id);
  const publications =
    lecturerIds.length > 0
      ? await db.publication.findMany({
          where: { lecturerId: { in: lecturerIds } },
          orderBy: [{ year: "desc" }, { order: "asc" }],
          take: 12,
        })
      : [];

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Research", href: "/research" },
            { label: area.title },
          ]}
        />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">{area.title}</h1>

        {area.image ? (
          <div className="relative mt-6 aspect-video overflow-hidden rounded-xl">
            <CloudImage
              src={area.image.url}
              alt={area.image.alt ?? area.title}
              fill
              priority
              sizes="(min-width: 1024px) 768px, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        <p className="mt-6 text-base text-muted-foreground">{area.summary}</p>
        <Prose className="mt-4" dangerouslySetInnerHTML={{ __html: renderRichText(area.body) }} />

        {area.lecturers.length > 0 ? (
          <div className="mt-10">
            <h2 className="font-heading text-xl font-semibold">Lecturers in this area</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {area.lecturers.map((lecturer) => (
                <PersonCard
                  key={lecturer.id}
                  name={lecturer.fullName}
                  rank={rankLabel(lecturer.rank)}
                  photoUrl={lecturer.photo?.url}
                  href={`/lecturer/${lecturer.slug}`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {publications.length > 0 ? (
          <div className="mt-10">
            <h2 className="font-heading text-xl font-semibold">Selected publications</h2>
            <ul className="mt-4 space-y-3">
              {publications.map((pub) => (
                <li key={pub.id} className="text-sm">
                  <p className="font-medium">{pub.title}</p>
                  <p className="text-muted-foreground">
                    {pub.authorsText}
                    {pub.venue ? `, ${pub.venue}` : ""} ({pub.year})
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
