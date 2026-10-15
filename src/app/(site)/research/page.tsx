import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listResearchAreasPublic } from "@/server/services/research-areas";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { CloudImage } from "@/components/ui/cloud-image";

export const metadata: Metadata = {
  title: "Research",
  description: "Areas of active research in the Department of Mathematics.",
};

export default async function ResearchPage() {
  const areas = await listResearchAreasPublic(db);

  return (
    <Section>
      <Container className="max-w-5xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Research" }]} />
        <PageHeader
          className="mt-4"
          title="Research"
          description="Our faculty engage in internationally recognised research across diverse branches of mathematics."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <Link key={area.id} href={`/research/${area.slug}`} className="block">
              <Card className="h-full py-4 transition-colors hover:border-primary/40">
                {area.image ? (
                  <div className="relative mx-4 mb-2 aspect-video overflow-hidden rounded-md">
                    <CloudImage
                      src={area.image.url}
                      alt={area.image.alt ?? area.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <CardContent className="px-4">
                  <h2 className="font-heading font-semibold">{area.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{area.summary}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Research area details are not available right now.</p>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
