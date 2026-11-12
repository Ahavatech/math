import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPage } from "@/server/services/site-content";
import { formatDateWAT } from "@/lib/time";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { renderRichText } from "@/lib/sanitize-html";

export const metadata: Metadata = {
  title: "Privacy notice",
};

export default async function PrivacyPage() {
  const page = await getPublishedPage("privacy");
  if (!page) notFound();

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Privacy notice" }]} />
        <PageHeader
          className="mt-4"
          title={page.title}
          description={`Last updated ${formatDateWAT(page.updatedAt)}`}
        />
        <Prose className="mt-8" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
      </Container>
    </Section>
  );
}
