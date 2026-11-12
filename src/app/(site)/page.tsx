import { safeJsonLdString, buildOrganizationJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Prose } from "@/components/ui/prose";
import { CloudImage } from "@/components/ui/cloud-image";
import { renderRichText } from "@/lib/sanitize-html";
import { NewsCard } from "@/components/sections/news-card";
import { EventCard } from "@/components/sections/event-card";
import { PersonCard } from "@/components/sections/person-card";
import { RiemannFigure } from "@/components/sections/riemann-figure";
import { getHodWelcome, getHomepageHero } from "@/server/services/site-content";
import { getHomepageStats } from "@/server/services/stats";
import {
  listResearchAreas,
  listLatestNews,
  listUpcomingEvents,
  getFeaturedLecturer,
  getFeaturedAlumni,
  getHeroImage,
} from "@/server/services/homepage";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { rankLabel } from "@/lib/lecturer-rank";

/**
 * The places most visitors come for, grouped by who is asking. These are
 * the site's own sections (routes), not editable content; the labels the
 * admin controls live in the navigation menu.
 */
const FIND_IT_FAST: Array<{
  heading: string;
  links: Array<{ label: string; href: string; note: string }>;
}> = [
  {
    heading: "Students",
    links: [
      { label: "Courses", href: "/students/courses", note: "Codes, units, prerequisites" },
      { label: "Handbook", href: "/students/handbook", note: "Rules, regulations, advice" },
      { label: "Academic calendar", href: "/students/calendar", note: "Dates for the session" },
      { label: "Downloads and forms", href: "/students/downloads", note: "Documents to print" },
    ],
  },
  {
    heading: "Applicants",
    links: [
      { label: "Programmes", href: "/programmes", note: "B.Sc., M.Sc. and Ph.D." },
      { label: "Research areas", href: "/research", note: "What we study" },
      { label: "Ask a question", href: "/contact", note: "Admissions and general" },
    ],
  },
  {
    heading: "News and events",
    links: [
      { label: "Latest news", href: "/news", note: "Announcements" },
      { label: "Events and seminars", href: "/events", note: "Upcoming and past" },
      { label: "Search the site", href: "/search", note: "People, courses, papers" },
    ],
  },
  {
    heading: "People and journal",
    links: [
      { label: "Staff directory", href: "/staff", note: "Profiles and contacts" },
      { label: "Alumni", href: "/alumni", note: "Where graduates are now" },
      { label: "Departmental journal", href: "/journal", note: "Read and submit" },
    ],
  },
];

export default async function Home() {
  const [hero, hod, stats, researchAreas, news, events, lecturer, alumni] = await Promise.all([
    getHomepageHero(),
    getHodWelcome(),
    getHomepageStats(db),
    listResearchAreas(),
    listLatestNews(),
    listUpcomingEvents(),
    getFeaturedLecturer(),
    getFeaturedAlumni(),
  ]);
  const heroImage = await getHeroImage(hero.imageId);

  // Counts that are zero say nothing to a visitor, so they are left out.
  const figures = [
    { label: "academic staff", value: stats.staff.value },
    { label: "programmes", value: stats.programmes.value },
    { label: "research areas", value: stats.researchAreas.value },
    { label: "alumni on record", value: stats.alumni.value },
  ].filter((figure) => figure.value > 0);

  return (
    <>
      <Section className="relative overflow-hidden pt-10 pb-14 sm:pt-16 sm:pb-20">
        <div aria-hidden="true" className="grid-paper grid-fade pointer-events-none absolute inset-0 -z-10" />
        <Container className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
          <div>
            {hero.heading ? (
              <h1 className="font-heading text-[2.5rem] leading-[1.04] font-semibold text-balance sm:text-6xl">
                {hero.heading}
              </h1>
            ) : (
              <h1 className="font-heading text-[2.5rem] leading-[1.04] font-semibold text-balance sm:text-6xl">
                Department of Mathematics
              </h1>
            )}
            {hero.subheading ? (
              <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {hero.subheading}
              </p>
            ) : null}
            {hero.ctaLabel && hero.ctaHref ? (
              <Button
                className="mt-7 h-12 px-6 text-base"
                nativeButton={false}
                render={<Link href={hero.ctaHref} />}
              >
                {hero.ctaLabel}
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Button>
            ) : null}
            {figures.length > 0 ? (
              <p className="tabular mt-8 max-w-[52ch] border-t border-border pt-4 text-[0.9375rem] text-muted-foreground">
                {figures.map((figure, index) => (
                  <span key={figure.label}>
                    {index > 0 ? ", " : ""}
                    <strong className="font-semibold text-foreground">{figure.value}</strong>{" "}
                    {figure.label}
                  </span>
                ))}
                .
              </p>
            ) : null}
          </div>

          {heroImage ? (
            <div className="relative aspect-[4/3] overflow-hidden border border-foreground">
              <CloudImage
                src={heroImage.url}
                alt={heroImage.alt ?? ""}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            <RiemannFigure className="mx-auto w-full max-w-xl" />
          )}
        </Container>
      </Section>

      <Section className="pt-0 sm:pt-0">
        <Container>
          <SectionHead title="Find what you need" />
          <div className="mt-2 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {FIND_IT_FAST.map((group) => (
              <div key={group.heading} className="pt-4">
                <h3 className="font-heading text-lg font-semibold">{group.heading}</h3>
                <ul className="mt-2">
                  {group.links.map((link) => (
                    <li key={link.href} className="index-row border-t border-border">
                      <Link
                        href={link.href}
                        className="flex min-h-14 items-center justify-between gap-3 py-2.5"
                      >
                        <span>
                          <span className="block font-medium">{link.label}</span>
                          <span className="block text-sm text-muted-foreground">{link.note}</span>
                        </span>
                        <ArrowRight
                          className="row-arrow size-4 shrink-0 text-accent"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-14 lg:grid-cols-[3fr_2fr] lg:gap-12">
          <div>
            <SectionHead title="News" href="/news" linkLabel="All news" />
            {news.length > 0 ? (
              <div>
                {news.map((post) => (
                  <NewsCard
                    key={post.id}
                    title={post.title}
                    excerpt={post.excerpt ?? undefined}
                    category={post.category}
                    publishedAt={post.publishedAt!}
                    href={`/news/${post.slug}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyLine>
                No news has been posted yet. Announcements will appear here as soon as they are
                published.
              </EmptyLine>
            )}
          </div>

          <div>
            <SectionHead title="Events" href="/events" linkLabel="All events" />
            {events.length > 0 ? (
              <div>
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    title={event.title}
                    type={event.type}
                    startsAt={event.startsAt}
                    venue={event.venue ?? undefined}
                    href={`/events/${event.slug}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyLine>
                Nothing is scheduled right now.{" "}
                <Link href="/events" className="link-rule font-medium text-foreground">
                  Browse past events
                </Link>
                .
              </EmptyLine>
            )}
          </div>
        </Container>
      </Section>

      {hod.name && hod.message ? (
        <Section>
          <Container className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-14">
            <div>
              <h2 className="font-heading text-3xl leading-tight font-semibold">
                From the Head of Department
              </h2>
              <p className="mt-6 border-t-2 border-accent pt-3 font-heading text-lg font-semibold">
                {hod.name}
              </p>
              {hod.title ? <p className="text-muted-foreground">{hod.title}</p> : null}
            </div>
            <div>
              <Prose
                className="line-clamp-[9] [&>*:first-child]:mt-0"
                dangerouslySetInnerHTML={{ __html: renderRichText(hod.message) }}
              />
              <Link
                href="/about"
                className="link-rule mt-5 inline-block py-1 font-medium text-primary"
              >
                Read the full address
              </Link>
            </div>
          </Container>
        </Section>
      ) : null}

      {researchAreas.length > 0 ? (
        <Section>
          <Container>
            <SectionHead title="Research areas" href="/research" linkLabel="All research areas" />
            <ul className="grid gap-x-12 md:grid-cols-2">
              {researchAreas.map((area) => (
                <li key={area.id} className="index-row border-t border-border">
                  <Link
                    href={`/research/${area.slug}`}
                    className="flex min-h-16 items-start justify-between gap-4 py-4"
                  >
                    <span>
                      <span className="block font-heading text-lg font-semibold">{area.title}</span>
                      {area.summary ? (
                        <span className="mt-1 line-clamp-2 block text-muted-foreground">
                          {area.summary}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight
                      className="row-arrow mt-1.5 size-4 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {lecturer || alumni.length > 0 ? (
        <Section>
          <Container className="grid gap-14 lg:grid-cols-2 lg:gap-12">
            {lecturer ? (
              <div>
                <SectionHead title="Featured lecturer" href="/staff" linkLabel="All staff" />
                <PersonCard
                  name={`${lecturer.honorific ? lecturer.honorific + " " : ""}${lecturer.fullName}`}
                  rank={rankLabel(lecturer.rank)}
                  photoUrl={lecturer.photo?.url}
                  href={`/lecturer/${lecturer.slug}`}
                />
              </div>
            ) : null}
            {alumni.length > 0 ? (
              <div>
                <SectionHead title="Alumni" href="/alumni" linkLabel="Alumni directory" />
                <ul>
                  {alumni.map((entry) => (
                    <li key={entry.id} className="border-t border-border py-4">
                      <p className="font-heading text-lg font-semibold">{entry.fullName}</p>
                      <p className="text-muted-foreground">
                        {entry.roleOrField ? `${entry.roleOrField}, ` : ""}
                        {entry.organisation ?? ""}
                        {entry.programmes[0] ? ` (class of ${entry.programmes[0].graduationYear})` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Container>
        </Section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(buildOrganizationJsonLd(SITE_URL)) }}
      />
    </>
  );
}

function SectionHead({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-4 border-b-2 border-foreground pb-3">
      <h2 className="font-heading text-3xl leading-tight font-semibold">{title}</h2>
      {href && linkLabel ? (
        <Link href={href} className="link-rule shrink-0 py-2 text-[0.9375rem] font-medium text-primary">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-border py-5 text-muted-foreground">{children}</p>;
}
