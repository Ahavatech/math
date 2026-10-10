import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
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
      <Container className="max-w-4xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Programmes" }]} />
        <PageHeader
          className="mt-4"
          title="Programmes"
          description="From foundational undergraduate study to advanced doctoral research."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {programmes.map((programme) => (
            <Card key={programme.id} className="h-full py-4">
              <CardContent className="px-4">
                <h2 className="font-heading font-semibold">{programme.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{programme.duration}</p>
                <p className="mt-2 text-sm text-muted-foreground">{programme.summary}</p>
                <Link
                  href={`/programmes/${enumToLevelSlug(programme.level)}`}
                  className="mt-3 inline-block text-sm text-primary hover:underline"
                >
                  Learn more
                </Link>
              </CardContent>
            </Card>
          ))}
          {programmes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Programme details are not available right now.</p>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}

function listPublished() {
  return db.programme.findMany({ where: { status: "PUBLISHED" }, orderBy: { level: "asc" } });
}
