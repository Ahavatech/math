import { db } from "@/lib/db";
import { listCalendarEntriesPublic, buildCalendarIcsFeed } from "@/server/services/academic-calendar";

export async function GET() {
  const entries = await listCalendarEntriesPublic(db);
  const ics = buildCalendarIcsFeed(entries);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="academic-calendar.ics"`,
    },
  });
}
