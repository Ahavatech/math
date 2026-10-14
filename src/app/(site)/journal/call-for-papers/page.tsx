import { notFound } from "next/navigation";
import { getJournalPagePublic } from "@/server/services/journal-pages";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";

export const revalidate = 300;

export async function generateMetadata() {
  return { title: "Call for Papers" };
}

export default async function JournalCallForPapersPage() {
  const page = await getJournalPagePublic("journal-call-for-papers");
  if (!page) notFound();

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Call for papers" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold">{page.title}</h1>
        <Prose className="mt-4" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
      </Container>
    </Section>
  );
}
