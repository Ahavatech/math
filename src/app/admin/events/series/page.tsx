import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listEventSeriesAdmin } from "@/server/services/events";
import { SeriesForm } from "./series-form";

export default async function AdminEventSeriesPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "events.manage")) {
    redirect("/403");
  }

  const series = await listEventSeriesAdmin(db);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Event series</h1>
        <Link href="/admin/events" className="text-sm text-primary underline">Back to events</Link>
      </div>

      <SeriesForm series={null} />

      <ul className="space-y-2">
        {series.map((s) => (
          <li key={s.id} className="rounded-md border border-border p-3">
            <p className="font-medium">{s.title}</p>
            <p className="text-xs text-muted-foreground">{s._count.events} event(s)</p>
            <SeriesForm series={s} />
          </li>
        ))}
        {series.length === 0 ? <p className="text-sm text-muted-foreground">No series yet.</p> : null}
      </ul>
    </div>
  );
}
