import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listEventsPublic } from "@/server/services/events";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterLinks, UnderlineTabs, PageNav } from "@/components/ui/filter-links";
import { EventCard } from "@/components/sections/event-card";
import { CalendarDays } from "lucide-react";
import { humanise } from "@/lib/labels";

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
        <PageHeader
          className="mt-4"
          title="Events"
          description="Seminars, colloquia and special lectures at the department."
        />

        <div className="mt-6">
          <UnderlineTabs
            label="Event period"
            items={[
              { label: "Upcoming", href: "/events?tab=upcoming", active: tab === "upcoming" },
              { label: "Past", href: "/events?tab=past", active: tab === "past" },
            ]}
          />
        </div>

        <div className="mt-5">
          <FilterLinks
            label="Event types"
            items={[
              { label: "All types", href: `/events?tab=${tab}`, active: !type },
              ...TYPES.map((t) => ({
                label: humanise(t),
                href: `/events?tab=${tab}&type=${t}`,
                active: type === t,
              })),
            ]}
          />
        </div>

        {events.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={CalendarDays}
              title={tab === "upcoming" ? "No upcoming events" : "No past events"}
              description="Check back soon."
            />
            {tab === "upcoming" ? (
              <p className="mt-4 text-center">
                <Link href="/events?tab=past" className="link-rule py-2 font-medium text-primary">
                  Browse past events
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-x-12 md:grid-cols-2">
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
              <PageNav page={page} totalPages={totalPages} hrefFor={pageHref} />
            ) : null}
          </>
        )}

        <p className="mt-10 border-t border-border pt-4 text-muted-foreground">
          <Link href="/events/feed.ics" className="link-rule py-2 font-medium text-primary">
            Subscribe to upcoming events (.ics)
          </Link>
        </p>
      </Container>
    </Section>
  );
}
