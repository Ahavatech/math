import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAboutImage, getHodWelcome, getPublishedPage } from "@/server/services/site-content";
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
  const [page, hod, about] = await Promise.all([getPublishedPage("about"), getHodWelcome(), getAboutImage()]);
  const [hodPhoto, aboutPhoto] = await Promise.all([getHeroImage(hod.photoId), getHeroImage(about.imageId)]);

  if (!page && !hod.message) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
        {/* Always a page title, even when the About text is not published yet. */}
        <PageHeader className="mt-4" title={page?.title ?? "About the department"} />
        {/* The About text on the left; the department photograph in the empty space beside it. On a
            phone the photograph comes first, then the text. */}
        {page || aboutPhoto ? (
          <div
            className={`mt-8 grid gap-8 ${
              page && aboutPhoto ? "lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_26rem]" : ""
            }`}
          >
            {page ? (
              <Prose className="max-lg:order-2" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
            ) : null}
            {aboutPhoto ? (
              <figure
                className={`max-lg:order-1 ${page ? "lg:sticky lg:top-24 lg:self-start" : "max-w-3xl"}`}
              >
                <div className="border border-foreground">
                  <CloudImage
                    src={aboutPhoto.url}
                    alt={aboutPhoto.alt ?? ""}
                    width={aboutPhoto.width ?? 1200}
                    height={aboutPhoto.height ?? 800}
                    priority
                    sizes="(min-width: 1280px) 416px, (min-width: 1024px) 336px, 100vw"
                    className="h-auto w-full"
                  />
                </div>
                {about.caption ? (
                  <figcaption className="mt-2 border-l-2 border-accent pl-3 text-sm text-muted-foreground">
                    {about.caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
          </div>
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
