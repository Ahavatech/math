import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listCalendarEntriesPublic } from "@/server/services/academic-calendar";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { outlineButton } from "@/components/ui/field-classes";
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
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Calendar" }]} />
        <PageHeader
          className="mt-4"
          title="Academic Calendar"
          description="Key dates for each academic session. Add them to your phone's calendar."
          actions={
            <>
              <a href="/students/calendar/feed.ics" className={outlineButton}>
                Subscribe
              </a>
              <a href="/students/calendar/feed.ics" download className={outlineButton}>
                Download .ics
              </a>
            </>
          }
        />

        {entries.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No calendar entries yet" description="Check back soon." className="mt-10" />
        ) : (
          <div className="mt-10 max-w-4xl space-y-12">
            {[...bySession.entries()].map(([session, sessionEntries]) => {
              const current = sessionEntries.filter((e) => !isPast(e));
              const past = sessionEntries.filter(isPast);
              return (
                <section key={session}>
                  <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                    {session}
                  </h2>
                  {current.length > 0 ? (
                    <ul>
                      {current.map((e) => (
                        <li
                          key={e.id}
                          className="grid gap-x-8 gap-y-1 border-b border-border py-4 sm:grid-cols-[15rem_1fr]"
                        >
                          <p className="tabular font-medium text-accent">
                            {formatDate(e.startDate)}
                            {e.endDate ? ` to ${formatDate(e.endDate)}` : ""}
                          </p>
                          <div>
                            <p className="font-heading text-lg font-semibold">{e.title}</p>
                            {e.description ? <p className="text-muted-foreground">{e.description}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {past.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer py-2 font-medium text-muted-foreground hover:text-foreground">
                        Past entries ({past.length})
                      </summary>
                      <ul>
                        {past.map((e) => (
                          <li
                            key={e.id}
                            className="grid gap-x-8 gap-y-1 border-b border-border py-3 text-muted-foreground sm:grid-cols-[15rem_1fr]"
                          >
                            <p className="tabular">
                              {formatDate(e.startDate)}
                              {e.endDate ? ` to ${formatDate(e.endDate)}` : ""}
                            </p>
                            <p>{e.title}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </Container>
    </Section>
  );
}
