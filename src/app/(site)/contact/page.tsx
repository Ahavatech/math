import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { env } from "@/lib/env";
import { signFormTimestamp } from "@/server/services/contact-spam";
import { getContactDetails } from "@/server/services/site-content";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const type = ["ADMISSIONS", "RESEARCH", "COLLABORATION", "ALUMNI", "GENERAL"].includes(params.type ?? "")
    ? (params.type as "ADMISSIONS" | "RESEARCH" | "COLLABORATION" | "ALUMNI" | "GENERAL")
    : "GENERAL";
  const { formToken, formRenderedAt } = signFormTimestamp(env.AUTH_SECRET);
  const contact = await getContactDetails();
  const hasDetails =
    contact.address || contact.phones.length > 0 || contact.email || contact.officeHours;

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
        <PageHeader
          className="mt-4"
          title="Contact"
          description="Write to the department about admissions, research, collaboration or anything else."
        />

        <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          {hasDetails ? (
            <div>
              <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                The department
              </h2>
              <dl className="mt-4 space-y-5">
                {contact.address ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Address</dt>
                    <dd className="whitespace-pre-line">{contact.address}</dd>
                  </div>
                ) : null}
                {contact.email ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Email</dt>
                    <dd>
                      <a href={`mailto:${contact.email}`} className="link-rule font-medium">
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {contact.phones.length > 0 ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Phone</dt>
                    {contact.phones.map((phone) => (
                      <dd key={phone} className="tabular">
                        {phone}
                      </dd>
                    ))}
                  </div>
                ) : null}
                {contact.officeHours ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">Office hours</dt>
                    <dd>{contact.officeHours}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          <div className={hasDetails ? "" : "lg:col-span-2 lg:max-w-xl"}>
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
              Send a message
            </h2>
            <ContactForm
              defaultType={type}
              reference={params.ref}
              formToken={formToken}
              formRenderedAt={formRenderedAt}
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
