import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listCalendarEntriesPublic } from "@/server/services/academic-calendar";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Academic Calendar",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function CalendarPage() {
  const entries = await listCalendarEntriesPublic(db);
  const now = new Date();

  const bySession = new Map<string, typeof entries>();
  for (const e of entries) {
    bySession.set(e.session, [...(bySession.get(e.session) ?? []), e]);
  }

  const isPast = (entry: (typeof entries)[number]) => (entry.endDate ?? entry.startDate) < now;

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Calendar" }]} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Academic Calendar</h1>
          <div className="flex gap-2 text-sm">
            <a href="/students/calendar/feed.ics" className="rounded-md border border-input px-3 py-1.5 hover:bg-muted">
              Subscribe
            </a>
            <a href="/students/calendar/feed.ics" download className="rounded-md border border-input px-3 py-1.5 hover:bg-muted">
              Download .ics
            </a>
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No calendar entries yet" description="Check back soon." className="mt-10" />
        ) : (
          <div className="mt-8 space-y-8">
            {[...bySession.entries()].map(([session, sessionEntries]) => {
              const current = sessionEntries.filter((e) => !isPast(e));
              const past = sessionEntries.filter(isPast);
              return (
                <div key={session}>
                  <h2 className="font-heading text-xl font-semibold">{session}</h2>
                  {current.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {current.map((e) => (
                        <li key={e.id} className="rounded-md border border-border p-3">
                          <p className="font-medium">{e.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(e.startDate)}{e.endDate ? ` to ${formatDate(e.endDate)}` : ""}
                          </p>
                          {e.description ? <p className="mt-1 text-sm text-muted-foreground">{e.description}</p> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {past.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground">Past entries ({past.length})</summary>
                      <ul className="mt-2 space-y-2">
                        {past.map((e) => (
                          <li key={e.id} className="rounded-md border border-border p-3 text-muted-foreground">
                            <p className="font-medium">{e.title}</p>
                            <p className="text-sm">{formatDate(e.startDate)}{e.endDate ? ` to ${formatDate(e.endDate)}` : ""}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </Section>
  );
}
