import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listDownloadsPublic } from "@/server/services/downloads";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
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
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students", href: "/students" }, { label: "Downloads" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Downloads</h1>

        {downloads.length === 0 ? (
          <EmptyState icon={DownloadIcon} title="No downloads yet" description="Check back soon." className="mt-10" />
        ) : (
          <div className="mt-8 space-y-8">
            {[...byCategory.entries()].map(([category, items]) => (
              <div key={category}>
                <h2 className="font-heading text-xl font-semibold">{CATEGORY_LABELS[category] ?? category}</h2>
                <ul className="mt-4 space-y-2">
                  {items.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                      <div>
                        <p className="font-medium">{d.title}</p>
                        {d.description ? <p className="text-sm text-muted-foreground">{d.description}</p> : null}
                      </div>
                      <a
                        href={d.fileUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        Download{d.fileSize ? ` (${Math.round(d.fileSize / 1024)} KB)` : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
