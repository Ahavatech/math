import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublishedEventBySlug } from "@/server/services/events";
import { generateEventIcs } from "@/lib/ics";
import { env } from "@/lib/env";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(db, slug);
  if (!event) notFound();

  const ics = generateEventIcs({
    id: event.id,
    title: event.title,
    description: event.description ? event.description.replace(/<[^>]+>/g, "") : "",
    venue: event.venue ?? "",
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    url: `${env.AUTH_URL}/events/${event.slug}`,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
