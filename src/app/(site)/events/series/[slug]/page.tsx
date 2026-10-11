import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEventSeriesBySlugPublic } from "@/server/services/events";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EventCard } from "@/components/sections/event-card";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const series = await getEventSeriesBySlugPublic(db, slug);
  if (!series) return {};
  return { title: series.title, description: series.description ?? undefined };
}

export default async function EventSeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getEventSeriesBySlugPublic(db, slug);
  if (!series) notFound();

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: series.title }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">{series.title}</h1>
        {series.description ? <p className="mt-2 text-muted-foreground">{series.description}</p> : null}

        {series.events.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {series.events.map((event) => (
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
          <p className="mt-8 text-sm text-muted-foreground">No events in this series yet.</p>
        )}
      </Container>
    </Section>
  );
}
