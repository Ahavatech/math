import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { enumToLevelSlug } from "@/lib/programme-level";

export const metadata: Metadata = {
  title: "Programmes",
  description: "Undergraduate and postgraduate mathematics programmes at Obafemi Awolowo University.",
};

export default async function ProgrammesPage() {
  let programmes: Awaited<ReturnType<typeof listPublished>> = [];
  try {
    programmes = await listPublished();
  } catch {
    programmes = [];
  }

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Programmes" }]} />
        <PageHeader
          className="mt-4"
          title="Programmes"
          description="From foundational undergraduate study to advanced doctoral research."
        />
        <ul className="mt-6">
          {programmes.map((programme) => (
            <li key={programme.id} className="index-row border-t border-border">
              <Link
                href={`/programmes/${enumToLevelSlug(programme.level)}`}
                className="grid gap-x-10 gap-y-2 py-7 md:grid-cols-[1fr_2fr_auto] md:items-baseline"
              >
                <span>
                  <span className="block font-heading text-3xl leading-tight font-semibold">
                    {programme.title}
                  </span>
                  <span className="tabular mt-1 block text-muted-foreground">
                    {programme.duration}
                  </span>
                </span>
                <span className="max-w-[60ch] text-lg leading-relaxed text-muted-foreground">
                  {programme.summary}
                </span>
                <span className="flex items-center gap-2 font-medium text-primary">
                  Learn more
                  <ArrowRight className="row-arrow size-4 text-accent" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {programmes.length === 0 ? (
          <p className="border-t border-border py-5 text-muted-foreground">
            Programme details are not available right now.
          </p>
        ) : (
          <div className="border-t border-border" />
        )}
      </Container>
    </Section>
  );
}

function listPublished() {
  return db.programme.findMany({ where: { status: "PUBLISHED" }, orderBy: { level: "asc" } });
}
