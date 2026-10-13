import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
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

  return (
    <Section>
      <Container className="max-w-xl">
        <PageHeader title="Contact" />
        <ContactForm defaultType={type} reference={params.ref} />
      </Container>
    </Section>
  );
}
