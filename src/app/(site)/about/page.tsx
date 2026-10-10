import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHodWelcome } from "@/server/services/site-content";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Prose } from "@/components/ui/prose";
import { CloudImage } from "@/components/ui/cloud-image";
import { renderRichText } from "@/lib/sanitize-html";

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const [page, hod] = await Promise.all([
    db.page.findFirst({ where: { slug: "about", status: "PUBLISHED" } }),
    getHodWelcome(),
  ]);
  const hodPhoto = hod.photoId ? await db.mediaAsset.findUnique({ where: { id: hod.photoId } }) : null;

  if (!page && !hod.message) {
    notFound();
  }

  return (
    <Section>
      <Container className="max-w-3xl">
        {page ? (
          <>
            <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{page.title}</h1>
            <Prose
              className="mt-6"
              dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }}
            />
          </>
        ) : null}

        {hod.message ? (
          <div className="mt-12 border-t border-border pt-10">
            <h2 className="font-heading text-2xl font-semibold">A welcome from the Head of Department</h2>
            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
              {hodPhoto ? (
                <div className="relative size-28 shrink-0 overflow-hidden rounded-full">
                  <CloudImage
                    src={hodPhoto.url}
                    alt={hodPhoto.alt ?? hod.name}
                    fill
                    priority
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <Prose dangerouslySetInnerHTML={{ __html: renderRichText(hod.message) }} />
                <p className="mt-4 font-heading font-semibold">{hod.name}</p>
                {hod.title ? <p className="text-sm text-muted-foreground">{hod.title}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
