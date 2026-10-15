import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listCalendarEntriesAdmin } from "@/server/services/academic-calendar";
import { CalendarEntryForm } from "./calendar-entry-form";
import { CalendarEntryRow } from "./calendar-entry-row";

export default async function AdminCalendarPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const entries = await listCalendarEntriesAdmin(db);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Academic calendar</h1>

      <CalendarEntryForm entry={null} />

      <ul className="space-y-2">
        {entries.map((entry) => (
          <CalendarEntryRow key={entry.id} entry={entry} />
        ))}
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No calendar entries yet.</p> : null}
      </ul>
    </div>
  );
}
