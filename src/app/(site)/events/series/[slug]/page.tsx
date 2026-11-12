import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEventSeriesBySlugPublic } from "@/server/services/events";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
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
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: series.title }]} />
        <PageHeader
          className="mt-4"
          title={series.title}
          description={series.description ?? undefined}
        />

        {series.events.length > 0 ? (
          <div className="mt-6 grid gap-x-12 md:grid-cols-2">
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
          <p className="mt-8 border-t border-border py-5 text-muted-foreground">No events in this series yet.</p>
        )}
      </Container>
    </Section>
  );
}
