import { notFound } from "next/navigation";
import { getJournalPagePublic } from "@/server/services/journal-pages";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";

export const revalidate = 300;

export async function generateMetadata() {
  return { title: "Journal Policies" };
}

export default async function JournalPoliciesPage() {
  const page = await getJournalPagePublic("journal-policies");
  if (!page) notFound();

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Policies" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold">{page.title}</h1>
        <Prose className="mt-4" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
      </Container>
    </Section>
  );
}
