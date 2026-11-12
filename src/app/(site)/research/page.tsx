import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { listResearchAreasPublic } from "@/server/services/research-areas";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CloudImage } from "@/components/ui/cloud-image";

export const metadata: Metadata = {
  title: "Research",
  description: "Areas of active research in the Department of Mathematics.",
};

export default async function ResearchPage() {
  const areas = await listResearchAreasPublic(db);

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Research" }]} />
        <PageHeader
          className="mt-4"
          title="Research"
          description="Our faculty engage in internationally recognised research across diverse branches of mathematics."
        />
        <ul className="mt-6 grid gap-x-12 md:grid-cols-2">
          {areas.map((area) => (
            <li key={area.id} className="index-row border-t border-border">
              <Link
                href={`/research/${area.slug}`}
                className="flex items-start justify-between gap-5 py-5"
              >
                <span className="flex min-w-0 gap-4">
                  {area.image ? (
                    <span className="relative hidden size-20 shrink-0 overflow-hidden border border-border sm:block">
                      <CloudImage
                        src={area.image.url}
                        alt={area.image.alt ?? area.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </span>
                  ) : null}
                  <span>
                    <span className="block font-heading text-xl font-semibold">{area.title}</span>
                    <span className="mt-1 block text-muted-foreground">{area.summary}</span>
                  </span>
                </span>
                <ArrowRight
                  className="row-arrow mt-1.5 size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
        {areas.length === 0 ? (
          <p className="border-t border-border py-5 text-muted-foreground">
            Research area details are not available right now.
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
