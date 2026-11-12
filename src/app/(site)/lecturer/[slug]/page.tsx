import type { Metadata } from "next";
import Link from "next/link";
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
import { safeJsonLdString, buildPersonJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";

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

  const jsonLd = buildPersonJsonLd({
    name: lecturer.fullName,
    slug: lecturer.slug,
    honorific: lecturer.honorific,
    rank: rankLabel(lecturer.rank),
    bio: lecturer.bio,
    photoUrl: lecturer.photo?.url,
    email: lecturer.publicEmail,
    orcid: lecturer.orcid,
    siteUrl: SITE_URL,
  });

  const linkClass = "link-rule inline-block py-1 font-medium text-primary";
  const externalLinks = [
    lecturer.scholarUrl ? { label: "Google Scholar", href: lecturer.scholarUrl } : null,
    lecturer.orcid ? { label: "ORCID", href: `https://orcid.org/${lecturer.orcid}` } : null,
    lecturer.researchGateUrl ? { label: "ResearchGate", href: lecturer.researchGateUrl } : null,
    lecturer.linkedinUrl ? { label: "LinkedIn", href: lecturer.linkedinUrl } : null,
  ].filter((item): item is { label: string; href: string } => item !== null);

  return (
    <Section>
      <Container>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Staff", href: "/staff" },
            { label: displayName },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-16">
          <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
            {lecturer.photo ? (
              <CloudImage
                src={lecturer.photo.url}
                alt={lecturer.photo.alt ?? displayName}
                width={288}
                height={288}
                priority
                className="aspect-square w-40 border border-foreground object-cover lg:w-full"
              />
            ) : null}

            {hasContact ? (
              <div>
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-lg font-semibold">
                  Contact
                </h2>
                <dl className="mt-3 space-y-3">
                  {lecturer.publicEmail ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">Email</dt>
                      <dd className="break-words">
                        <a href={`mailto:${lecturer.publicEmail}`} className="link-rule font-medium">
                          {lecturer.publicEmail}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {lecturer.phone ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">Phone</dt>
                      <dd className="tabular">{lecturer.phone}</dd>
                    </div>
                  ) : null}
                  {lecturer.officeLocation ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">Office</dt>
                      <dd>{lecturer.officeLocation}</dd>
                    </div>
                  ) : null}
                  {lecturer.officeHours ? (
                    <div>
                      <dt className="text-sm text-muted-foreground">Office hours</dt>
                      <dd>{lecturer.officeHours}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {hasLinks || lecturer.cvDownload?.fileUrl ? (
              <div>
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-lg font-semibold">
                  Elsewhere
                </h2>
                <ul className="mt-2">
                  {externalLinks.map((item) => (
                    <li key={item.label}>
                      <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {item.label}
                      </a>
                    </li>
                  ))}
                  {lecturer.cvDownload?.fileUrl ? (
                    <li>
                      <a
                        href={lecturer.cvDownload.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        Download CV
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </aside>

          <div className="min-w-0">
            <h1 className="font-heading text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl">
              {displayName}
            </h1>
            <p className="mt-3 text-xl text-muted-foreground">
              {rankLabel(lecturer.rank)}
              {lecturer.isEmeritus ? " (Emeritus)" : ""}
            </p>
            {lecturer.researchAreas.length > 0 ? (
              <p className="mt-3">
                {lecturer.researchAreas.map((area, index) => (
                  <span key={area.id}>
                    {index > 0 ? ", " : ""}
                    <a href={`/research/${area.slug}`} className="link-rule font-medium text-primary">
                      {area.title}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}

            {lecturer.bio ? (
              <Prose
                className="mt-8"
                dangerouslySetInnerHTML={{ __html: renderRichText(lecturer.bio) }}
              />
            ) : null}

            {years.length > 0 ? (
              <section className="mt-12">
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                  Publications
                </h2>
                {years.map((year) => (
                  <div
                    key={year}
                    className="grid gap-x-8 border-b border-border py-5 sm:grid-cols-[5rem_1fr]"
                  >
                    <h3 className="tabular font-heading text-lg font-semibold text-accent">{year}</h3>
                    <ul className="space-y-4">
                      {(publicationsByYear.get(year) ?? [])
                        .slice(0, PUBLICATIONS_LIMIT_PER_YEAR)
                        .map((pub) => (
                          <li key={pub.id}>
                            <p className="font-medium">
                              {pub.url ? (
                                <a
                                  href={pub.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="link-rule"
                                >
                                  {pub.title}
                                </a>
                              ) : (
                                pub.title
                              )}
                            </p>
                            <p className="text-muted-foreground">
                              {pub.authorsText}
                              {pub.venue ? `, ${pub.venue}` : ""}
                              {pub.doi ? `, doi:${pub.doi}` : ""}
                            </p>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : null}

            {lecturer.courses.length > 0 ? (
              <section className="mt-12">
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                  Courses taught
                </h2>
                <ul className="grid gap-x-10 sm:grid-cols-2">
                  {lecturer.courses.map((course) => (
                    <li key={course.id} className="index-row border-b border-border">
                      <Link
                        href={`/students/courses/${course.slug}`}
                        className="flex min-h-14 items-baseline gap-4 py-3"
                      >
                        <span className="tabular font-semibold text-primary">{course.code}</span>
                        <span className="text-muted-foreground">{course.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {lecturer.supervisionText ? (
              <section className="mt-12">
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                  Students and supervision
                </h2>
                <Prose
                  className="mt-4"
                  dangerouslySetInnerHTML={{ __html: renderRichText(lecturer.supervisionText) }}
                />
              </section>
            ) : null}
          </div>
        </div>
      </Container>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />
    </Section>
  );
}

function renderDraftPreview(slug: string) {
  return (
    <Section>
      <Container className="max-w-3xl">
        <p className="border border-foreground bg-secondary p-4">
          This is a preview of an unpublished profile ({slug}). It is not visible to the public.
        </p>
      </Container>
    </Section>
  );
}
