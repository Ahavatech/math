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
import { Badge } from "@/components/ui/badge";
import { ZoomableImage } from "@/components/ui/zoomable-image";

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.startsAt.toISOString(),
    ...(event.endsAt ? { endDate: event.endsAt.toISOString() } : {}),
    ...(event.venue ? { location: { "@type": "Place", name: event.venue } } : {}),
    ...(event.flyer ? { image: [event.flyer.url] } : {}),
  };

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: event.title }]} />

        {event.flyer ? (
          <div className="relative mt-6 aspect-video overflow-hidden rounded-xl">
            <ZoomableImage src={event.flyer.url} alt={event.flyer.alt ?? event.title} priority />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{event.type}</Badge>
          <span>{formatWAT(event.startsAt)}</span>
          {event.endsAt ? <span>- {formatWAT(event.endsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}</span> : null}
        </div>
        <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">{event.title}</h1>
        {event.venue ? <p className="mt-1 text-muted-foreground">{event.venue}</p> : null}
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
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Register
            </a>
          ) : null}
          {event.slidesUrl ? (
            <a href={event.slidesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
              Slides
            </a>
          ) : null}
          {event.recordingUrl ? (
            <a href={event.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
              Recording
            </a>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
          <a href={`/events/${event.slug}/calendar.ics`} className="underline">
            Add to calendar (.ics)
          </a>
          <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Add to Google Calendar
          </a>
        </div>

        {event.series ? (
          <div className="mt-10 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              Part of{" "}
              <Link href={`/events/series/${event.series.slug}`} className="underline">
                {event.series.title}
              </Link>
            </p>
          </div>
        ) : null}

        {!upcoming && event.galleryImages.length > 0 ? (
          <div className="mt-10 border-t border-border pt-6">
            <h2 className="font-heading text-xl font-semibold">Gallery</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {event.galleryImages.map((img) => (
                <ZoomableImage key={img.id} src={img.media.url} alt={img.media.alt ?? ""} caption={img.caption ?? undefined} width={200} height={150} className="rounded-md" />
              ))}
            </div>
          </div>
        ) : null}
      </Container>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
