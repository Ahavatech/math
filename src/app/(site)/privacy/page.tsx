import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPage } from "@/server/services/site-content";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
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
      <Container className="max-w-3xl">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{page.title}</h1>
        <Prose className="mt-6" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
      </Container>
    </Section>
  );
}
