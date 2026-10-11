import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listEventsPublic } from "@/server/services/events";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { EventCard } from "@/components/sections/event-card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Events",
  description: "Seminars, colloquia and special lectures at the Department of Mathematics.",
};

const PER_PAGE = 12;
const TYPES = ["SEMINAR", "COLLOQUIUM", "SPECIAL_LECTURE", "CONFERENCE", "GRADUATION", "OTHER"] as const;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; type?: string; year?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number(params.page) || 1);
  const type = TYPES.includes(params.type as never) ? params.type : undefined;
  const year = tab === "past" && params.year ? Number(params.year) : undefined;

  const { events, total } = await listEventsPublic(db, { tab, page, perPage: PER_PAGE, type, year });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  function pageHref(targetPage: number) {
    const query = new URLSearchParams();
    query.set("tab", tab);
    query.set("page", String(targetPage));
    if (type) query.set("type", type);
    if (year) query.set("year", String(year));
    return `/events?${query.toString()}`;
  }

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Events</h1>

        <div className="mt-6 flex gap-2 text-sm">
          <Link href="/events?tab=upcoming" className={tab === "upcoming" ? "font-semibold underline" : "text-muted-foreground"}>
            Upcoming
          </Link>
          <Link href="/events?tab=past" className={tab === "past" ? "font-semibold underline" : "text-muted-foreground"}>
            Past
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/events?tab=${tab}`}>
            <Badge variant={!type ? "default" : "outline"}>All types</Badge>
          </Link>
          {TYPES.map((t) => (
            <Link key={t} href={`/events?tab=${tab}&type=${t}`}>
              <Badge variant={type === t ? "default" : "outline"}>{t}</Badge>
            </Link>
          ))}
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={tab === "upcoming" ? "No upcoming events" : "No past events"}
            description="Check back soon."
            className="mt-10"
          />
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  title={event.title}
                  type={event.type}
                  startsAt={event.startsAt}
                  venue={event.venue ?? undefined}
                  speakerName={event.speakerName ?? undefined}
                  href={`/events/${event.slug}`}
                />
              ))}
            </div>

            {totalPages > 1 ? (
              <nav className="mt-10 flex justify-center gap-4 text-sm" aria-label="Pagination">
                {page > 1 ? <Link href={pageHref(page - 1)} className="underline">Previous</Link> : null}
                <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                {page < totalPages ? <Link href={pageHref(page + 1)} className="underline">Next</Link> : null}
              </nav>
            ) : null}
          </>
        )}

        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/events/feed.ics" className="underline">Subscribe to upcoming events (.ics)</Link>
        </p>
      </Container>
    </Section>
  );
}
