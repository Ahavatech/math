import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listEventsAdmin } from "@/server/services/events";
import { isUpcoming } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { EventRow } from "./event-row";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "events.manage")) {
    redirect("/403");
  }

  const params = await searchParams;
  const tab = params.tab === "past" ? "past" : "upcoming";
  const allEvents = await listEventsAdmin(db);
  const now = new Date();

  const filteredByTab = allEvents.filter((e) => (tab === "upcoming" ? isUpcoming(e, now) : !isUpcoming(e, now)));
  const events = params.q
    ? filteredByTab.filter(
        (e) =>
          e.title.toLowerCase().includes(params.q!.toLowerCase()) ||
          (e.speakerName ?? "").toLowerCase().includes(params.q!.toLowerCase()),
      )
    : filteredByTab;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Events</h1>
        <div className="flex gap-2">
          <Button render={<Link href="/admin/events/series">Series</Link>} variant="outline" />
          <Button render={<Link href="/admin/events/new">New event</Link>} />
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <Link href="/admin/events?tab=upcoming" className={tab === "upcoming" ? "font-semibold underline" : "text-muted-foreground"}>
          Upcoming
        </Link>
        <Link href="/admin/events?tab=past" className={tab === "past" ? "font-semibold underline" : "text-muted-foreground"}>
          Past
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input type="search" name="q" defaultValue={params.q} placeholder="Search by title or speaker" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <Button type="submit" variant="outline" size="sm">Search</Button>
      </form>

      <ul className="space-y-2">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
        {events.length === 0 ? <p className="text-sm text-muted-foreground">No events match.</p> : null}
      </ul>
    </div>
  );
}
