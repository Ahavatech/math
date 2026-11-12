import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listDownloadsPublic } from "@/server/services/downloads";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { outlineButton } from "@/components/ui/field-classes";
import { Download as DownloadIcon } from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Downloads",
};

const CATEGORY_LABELS: Record<string, string> = {
  HANDBOOK: "Handbook",
  FORM: "Forms",
  GUIDELINE: "Guidelines",
  TIMETABLE: "Timetables",
  OTHER: "Other",
};

export default async function DownloadsPage() {
  const downloads = await listDownloadsPublic(db);
  const byCategory = new Map<string, typeof downloads>();
  for (const d of downloads) {
    byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]);
  }

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Downloads" }]} />
        <PageHeader
          className="mt-4"
          title="Downloads"
          description="Forms, guidelines, timetables and other documents."
        />

        {downloads.length === 0 ? (
          <EmptyState icon={DownloadIcon} title="No downloads yet" description="Check back soon." className="mt-10" />
        ) : (
          <div className="mt-10 max-w-4xl space-y-12">
            {[...byCategory.entries()].map(([category, items]) => (
              <section key={category}>
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
                <ul>
                  {items.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-lg font-semibold">{d.title}</p>
                        {d.description ? <p className="text-muted-foreground">{d.description}</p> : null}
                      </div>
                      <a
                        href={d.fileUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${outlineButton} shrink-0`}
                      >
                        Download{d.fileSize ? ` (${Math.round(d.fileSize / 1024)} KB)` : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
