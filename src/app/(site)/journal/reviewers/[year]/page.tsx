import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { listAcknowledgedReviewers } from "@/server/services/article-publication";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return { title: `Reviewers ${year}` };
}

export default async function ReviewerAcknowledgementPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) notFound();

  const reviewers = await listAcknowledgedReviewers(db, year);

  return (
    <Section>
      <Container className="max-w-2xl">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Journal", href: "/journal" },
            { label: `Reviewers ${year}` },
          ]}
        />
        <h1 className="mt-4 font-heading text-3xl font-semibold">
          Reviewers for {year}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          The journal gratefully acknowledges the following individuals who served as peer reviewers during {year}.
          Only reviewers who opted in to public acknowledgement are listed.
        </p>

        {reviewers.length === 0 ? (
          <p className="mt-6 text-muted-foreground">No reviewers to acknowledge for this year.</p>
        ) : (
          <ul className="mt-6 columns-2 gap-6 text-sm">
            {reviewers.map((r, i) => (
              <li key={i} className="mb-1">{r.name}</li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
