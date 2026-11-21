import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPage } from "@/server/services/site-content";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { renderRichText } from "@/lib/sanitize-html";

export const revalidate = 300;

/** The pages that live under /about. Anything else under /about is a 404. */
const ABOUT_PAGES: Record<string, string> = {
  "mission-vision": "Mission and vision",
  history: "History",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ABOUT_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = ABOUT_PAGES[slug] ? await getPublishedPage(slug) : null;
  return { title: page?.title ?? ABOUT_PAGES[slug] ?? "About" };
}

export default async function AboutSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!ABOUT_PAGES[slug]) notFound();
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  return (
    <Section>
      <Container>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "About", href: "/about" }, { label: page.title }]}
        />
        <PageHeader className="mt-4" title={page.title} />
        <Prose className="mt-8" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
      </Container>
    </Section>
  );
}
