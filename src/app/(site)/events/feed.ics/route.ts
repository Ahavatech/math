import { db } from "@/lib/db";
import { listUpcomingEventsForIcsFeed } from "@/server/services/events";
import { generateIcsFeed } from "@/lib/ics";
import { env } from "@/lib/env";

export async function GET() {
  const events = await listUpcomingEventsForIcsFeed(db);
  const siteUrl = env.AUTH_URL;

  const ics = generateIcsFeed(
    events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description ? event.description.replace(/<[^>]+>/g, "") : "",
      venue: event.venue ?? "",
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      url: `${siteUrl}/events/${event.slug}`,
    })),
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="department-events.ics"`,
    },
  });
}
