import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHodWelcome, getPublishedPage } from "@/server/services/site-content";
import { getHeroImage } from "@/server/services/homepage";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";
import { CloudImage } from "@/components/ui/cloud-image";
import { renderRichText } from "@/lib/sanitize-html";

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const [page, hod] = await Promise.all([getPublishedPage("about"), getHodWelcome()]);
  const hodPhoto = await getHeroImage(hod.photoId);

  if (!page && !hod.message) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
        {page ? (
          <>
            <PageHeader className="mt-4" title={page.title} />
            <Prose className="mt-8" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
          </>
        ) : null}

        {hod.message ? (
          <div className="mt-16 grid gap-8 border-t-2 border-foreground pt-8 lg:grid-cols-[18rem_1fr] lg:gap-16">
            <div>
              <h2 className="font-heading text-3xl leading-tight font-semibold">
                From the Head of Department
              </h2>
              {hodPhoto ? (
                <div className="relative mt-6 aspect-square w-40 overflow-hidden border border-foreground lg:w-full">
                  <CloudImage
                    src={hodPhoto.url}
                    alt={hodPhoto.alt ?? hod.name}
                    fill
                    priority
                    sizes="(min-width: 1024px) 288px, 160px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <p className="mt-6 border-t-2 border-accent pt-3 font-heading text-lg font-semibold">
                {hod.name}
              </p>
              {hod.title ? <p className="text-muted-foreground">{hod.title}</p> : null}
            </div>
            <Prose dangerouslySetInnerHTML={{ __html: renderRichText(hod.message) }} />
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
