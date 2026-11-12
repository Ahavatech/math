import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getDonationsPublic } from "@/server/services/donations";
import { formatDateWAT } from "@/lib/time";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { CopyButton } from "./copy-button";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Support the department",
  description: "How to give to the Department of Mathematics, Obafemi Awolowo University.",
};

export default async function DonatePage() {
  const donations = await getDonationsPublic(db);
  if (!donations) notFound();

  const { details, updatedAt } = donations;
  const paragraphs = details.intro
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const rows: Array<{ label: string; value: string; copy?: boolean }> = [
    { label: "Account name", value: details.accountName },
    { label: "Bank", value: details.bankName },
    { label: "Account number", value: details.accountNumber, copy: true },
    ...(details.swiftCode ? [{ label: "SWIFT code (gifts from abroad)", value: details.swiftCode }] : []),
    ...(details.reference ? [{ label: "Payment reference", value: details.reference }] : []),
  ];

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Support the department" }]} />
        <PageHeader className="mt-4" title={details.heading || "Support the department"} />

        <div className="mt-10 grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div>
            {paragraphs.length > 0 ? (
              <div className="max-w-[68ch] space-y-5 font-serif text-[1.0625rem] leading-[1.75]">
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            ) : null}

            {details.purposes.length > 0 ? (
              <section className="mt-12">
                <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">
                  What gifts support
                </h2>
                <ul>
                  {details.purposes.map((purpose) => (
                    <li key={purpose.title} className="border-b border-border py-4">
                      <p className="font-heading text-lg font-semibold">{purpose.title}</p>
                      {purpose.description ? (
                        <p className="text-muted-foreground">{purpose.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside aria-labelledby="how-to-give" className="lg:sticky lg:top-24 lg:self-start">
            <h2
              id="how-to-give"
              className="border-b-2 border-accent pb-2 font-heading text-2xl font-semibold"
            >
              How to give
            </h2>
            <p className="mt-3 text-muted-foreground">Send a bank transfer to this account.</p>
            <dl className="mt-2">
              {rows.map((row) => (
                <div key={row.label} className="border-b border-border py-3">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd
                    className={
                      row.copy
                        ? "tabular mt-0.5 font-heading text-2xl font-semibold break-all select-all"
                        : "mt-0.5 text-lg font-medium"
                    }
                  >
                    {row.value}
                  </dd>
                  {row.copy ? (
                    <div className="mt-2">
                      <CopyButton value={row.value} label="account number" />
                    </div>
                  ) : null}
                </div>
              ))}
            </dl>

            {details.receiptsNote ? <p className="mt-5">{details.receiptsNote}</p> : null}

            <p className="mt-5 border-t-2 border-foreground pt-4 text-[0.9375rem] text-muted-foreground">
              Before sending a large gift, please confirm these details with the department
              {details.contactEmail ? (
                <>
                  {" "}
                  at{" "}
                  <a href={`mailto:${details.contactEmail}`} className="link-rule font-medium text-foreground">
                    {details.contactEmail}
                  </a>
                </>
              ) : (
                <>
                  {" "}
                  through the <Link href="/contact" className="link-rule font-medium text-foreground">contact page</Link>
                </>
              )}
              .{updatedAt ? ` These details were last changed on ${formatDateWAT(updatedAt)}.` : ""}
            </p>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
