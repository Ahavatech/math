import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPublishedEventBySlug, findEventBySlugOrPrevious } from "@/server/services/events";
import { renderRichText } from "@/lib/sanitize-html";
import { formatWAT, isUpcoming } from "@/lib/time";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { humanise } from "@/lib/labels";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { safeJsonLdString, buildEventJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(db, slug);
  if (!event) return { robots: { index: false, follow: false } };
  return {
    title: event.title,
    description: event.description ? event.description.replace(/<[^>]+>/g, "").slice(0, 160) : event.title,
    openGraph: event.flyer ? { images: [{ url: event.flyer.url }] } : undefined,
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(db, slug);

  if (!event) {
    const lookup = await findEventBySlugOrPrevious(db, slug);
    if (lookup?.redirectTo) {
      redirect(`/events/${lookup.redirectTo}`);
    }
    notFound();
  }

  const upcoming = isUpcoming(event);
  const googleCalendarUrl = buildGoogleCalendarUrl(event);

  const jsonLd = buildEventJsonLd({
    title: event.title,
    slug: event.slug,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venue: event.venue,
    speakerName: event.speakerName,
    flyerUrl: event.flyer?.url,
    siteUrl: SITE_URL,
  });

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: event.title }]} />

        {event.flyer ? (
          <div className="relative mt-6 aspect-video overflow-hidden border border-border">
            <ZoomableImage src={event.flyer.url} alt={event.flyer.alt ?? event.title} priority />
          </div>
        ) : null}

        <p className="tabular mt-6 text-muted-foreground">
          <span className="font-semibold text-accent">{humanise(event.type)}</span>
          {", "}
          {formatWAT(event.startsAt)}
          {event.endsAt ? ` to ${formatWAT(event.endsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}` : ""}
        </p>
        <h1 className="mt-2 border-b-2 border-foreground pb-5 font-heading text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl">
          {event.title}
        </h1>
        {event.venue ? <p className="mt-4 text-lg text-muted-foreground">{event.venue}</p> : null}
        {event.speakerName ? (
          <p className="mt-1 text-muted-foreground">
            {event.speakerName}
            {event.speakerAffiliation ? `, ${event.speakerAffiliation}` : ""}
          </p>
        ) : null}

        {event.description ? (
          <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(event.description) }} />
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {upcoming && event.registrationUrl ? (
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center bg-primary px-5 text-[0.9375rem] font-medium text-primary-foreground transition-colors hover:bg-foreground"
            >
              Register
            </a>
          ) : null}
          {event.slidesUrl ? (
            <a href={event.slidesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center border border-foreground px-5 text-[0.9375rem] font-medium transition-colors hover:bg-foreground hover:text-background">
              Slides
            </a>
          ) : null}
          {event.recordingUrl ? (
            <a href={event.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center border border-foreground px-5 text-[0.9375rem] font-medium transition-colors hover:bg-foreground hover:text-background">
              Recording
            </a>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-5">
          <a href={`/events/${event.slug}/calendar.ics`} className="link-rule py-2 font-medium text-primary">
            Add to calendar (.ics)
          </a>
          <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="link-rule py-2 font-medium text-primary">
            Add to Google Calendar
          </a>
        </div>

        {event.series ? (
          <div className="mt-10 border-t border-border pt-6">
            <p className="text-muted-foreground">
              Part of{" "}
              <Link href={`/events/series/${event.series.slug}`} className="link-rule font-medium text-primary">
                {event.series.title}
              </Link>
            </p>
          </div>
        ) : null}

        {!upcoming && event.galleryImages.length > 0 ? (
          <div className="mt-10 border-t border-border pt-6">
            <h2 className="font-heading text-2xl font-semibold">Gallery</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {event.galleryImages.map((img) => (
                <ZoomableImage key={img.id} src={img.media.url} alt={img.media.alt ?? ""} caption={img.caption ?? undefined} width={200} height={150} className="border border-border" />
              ))}
            </div>
          </div>
        ) : null}
      </Container>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />
    </Section>
  );
}

function buildGoogleCalendarUrl(event: {
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: Date;
  endsAt: Date | null;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmt(event.startsAt)}/${fmt(end)}`,
    details: (event.description ?? "").replace(/<[^>]+>/g, ""),
    location: event.venue ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
