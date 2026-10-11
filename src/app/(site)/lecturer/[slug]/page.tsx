import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import {
  getPublishedLecturerBySlug,
  findLecturerBySlugOrPreviousSlug,
} from "@/server/services/lecturers";
import { rankLabel } from "@/lib/lecturer-rank";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { CloudImage } from "@/components/ui/cloud-image";
import { Badge } from "@/components/ui/badge";
import { safeJsonLdString } from "@/lib/json-ld";

export async function generateStaticParams() {
  try {
    const published = await db.lecturerProfile.findMany({
      where: { status: "PUBLISHED", user: { isActive: true } },
      select: { slug: true },
    });
    return published.map((p) => ({ slug: p.slug }));
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
  const lecturer = await getPublishedLecturerBySlug(db, slug);
  if (!lecturer) {
    return { robots: { index: false, follow: false } };
  }
  const title = [lecturer.honorific, lecturer.fullName].filter(Boolean).join(" ");
  return {
    title,
    description: lecturer.bio ? lecturer.bio.replace(/<[^>]+>/g, "").slice(0, 160) : undefined,
    openGraph: lecturer.photo ? { images: [{ url: lecturer.photo.url }] } : undefined,
  };
}

const PUBLICATIONS_LIMIT_PER_YEAR = 50;

export default async function LecturerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const lecturer = await getPublishedLecturerBySlug(db, slug);

  if (!lecturer) {
    const lookup = await findLecturerBySlugOrPreviousSlug(db, slug);
    if (lookup?.redirectTo) {
      redirect(`/lecturer/${lookup.redirectTo}`);
    }

    if (lookup && lookup.profile.status !== "PUBLISHED") {
      const user = await getCurrentUser();
      const isOwnerOrAdmin =
        user?.isActive && (user.id === lookup.profile.userId || hasPermission(user, "lecturers.manage"));
      if (isOwnerOrAdmin) {
        return renderDraftPreview(lookup.profile.slug);
      }
    }
    notFound();
  }

  const publicationsByYear = new Map<number, typeof lecturer.publications>();
  for (const pub of lecturer.publications) {
    const list = publicationsByYear.get(pub.year) ?? [];
    list.push(pub);
    publicationsByYear.set(pub.year, list);
  }
  const years = [...publicationsByYear.keys()].sort((a, b) => b - a);

  const displayName = [lecturer.honorific, lecturer.fullName].filter(Boolean).join(" ");
  const hasContact = lecturer.publicEmail || lecturer.phone || lecturer.officeLocation || lecturer.officeHours;
  const hasLinks = lecturer.scholarUrl || lecturer.orcid || lecturer.researchGateUrl || lecturer.linkedinUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: lecturer.fullName,
    jobTitle: rankLabel(lecturer.rank),
    affiliation: "Department of Mathematics, Obafemi Awolowo University",
    ...(lecturer.photo ? { image: lecturer.photo.url } : {}),
    ...(lecturer.publicEmail ? { email: lecturer.publicEmail } : {}),
  };

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: displayName }]} />

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          {lecturer.photo ? (
            <CloudImage
              src={lecturer.photo.url}
              alt={lecturer.photo.alt ?? displayName}
              width={160}
              height={160}
              priority
              className="rounded-xl object-cover"
            />
          ) : null}
          <div>
            <h1 className="font-heading text-2xl font-semibold sm:text-3xl">{displayName}</h1>
            <p className="mt-1 text-muted-foreground">
              {rankLabel(lecturer.rank)}
              {lecturer.isEmeritus ? " (Emeritus)" : ""}
            </p>
            {lecturer.researchAreas.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {lecturer.researchAreas.map((area) => (
                  <Badge key={area.id} render={<a href={`/research/${area.slug}`} />}>
                    {area.title}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {lecturer.bio ? (
          <Prose className="mt-8" dangerouslySetInnerHTML={{ __html: renderRichText(lecturer.bio) }} />
        ) : null}

        {hasContact ? (
          <div className="mt-8 space-y-1 text-sm">
            <h2 className="font-heading text-lg font-semibold">Contact</h2>
            {lecturer.officeLocation ? <p>Office: {lecturer.officeLocation}</p> : null}
            {lecturer.officeHours ? <p>Office hours: {lecturer.officeHours}</p> : null}
            {lecturer.publicEmail ? <p>Email: {lecturer.publicEmail}</p> : null}
            {lecturer.phone ? <p>Phone: {lecturer.phone}</p> : null}
          </div>
        ) : null}

        {hasLinks ? (
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            {lecturer.scholarUrl ? (
              <a href={lecturer.scholarUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Google Scholar
              </a>
            ) : null}
            {lecturer.orcid ? (
              <a
                href={`https://orcid.org/${lecturer.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                ORCID
              </a>
            ) : null}
            {lecturer.researchGateUrl ? (
              <a href={lecturer.researchGateUrl} target="_blank" rel="noopener noreferrer" className="underline">
                ResearchGate
              </a>
            ) : null}
            {lecturer.linkedinUrl ? (
              <a href={lecturer.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline">
                LinkedIn
              </a>
            ) : null}
          </div>
        ) : null}

        {years.length > 0 ? (
          <div className="mt-10">
            <h2 className="font-heading text-xl font-semibold">Publications</h2>
            {years.map((year) => (
              <div key={year} className="mt-4">
                <h3 className="font-heading text-base font-semibold">{year}</h3>
                <ul className="mt-2 space-y-3">
                  {(publicationsByYear.get(year) ?? []).slice(0, PUBLICATIONS_LIMIT_PER_YEAR).map((pub) => (
                    <li key={pub.id} className="text-sm">
                      <p className="font-medium">
                        {pub.url ? (
                          <a href={pub.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {pub.title}
                          </a>
                        ) : (
                          pub.title
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {pub.authorsText}
                        {pub.venue ? `, ${pub.venue}` : ""}
                        {pub.doi ? ` - doi:${pub.doi}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {lecturer.supervisionText ? (
          <div className="mt-10">
            <h2 className="font-heading text-xl font-semibold">Students and supervision</h2>
            <Prose className="mt-4" dangerouslySetInnerHTML={{ __html: renderRichText(lecturer.supervisionText) }} />
          </div>
        ) : null}

        {lecturer.cvDownload?.fileUrl ? (
          <div className="mt-10">
            <a
              href={lecturer.cvDownload.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Download CV
            </a>
          </div>
        ) : null}
      </Container>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />
    </Section>
  );
}

function renderDraftPreview(slug: string) {
  return (
    <Section>
      <Container className="max-w-3xl">
        <p className="rounded-md border border-border bg-muted p-4 text-sm">
          This is a preview of an unpublished profile ({slug}). It is not visible to the public.
        </p>
      </Container>
    </Section>
  );
}
