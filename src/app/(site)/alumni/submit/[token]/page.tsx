import type { Metadata } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { validateAlumniLinkToken } from "@/server/services/alumni-links";
import { signFormTimestamp } from "@/server/services/alumni-spam";
import { submitAlumniEntryAction } from "@/server/actions/alumni-submit";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = {
  title: "Alumni update",
  robots: { index: false, follow: false },
};

export default async function AlumniSubmitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const validation = await validateAlumniLinkToken(db, token);

  if (!validation.ok) {
    return (
      <Section>
        <Container className="max-w-xl">
          <PageHeader title="This link is no longer valid" />
          <p className="mt-4 text-sm text-muted-foreground">
            Please contact the department if you believe this is a mistake.
          </p>
        </Container>
      </Section>
    );
  }

  const { formToken, formRenderedAt } = signFormTimestamp(env.AUTH_SECRET);
  const boundAction = submitAlumniEntryAction.bind(null, token);

  return (
    <Section>
      <Container className="max-w-xl">
        <PageHeader
          title="Tell us where you are now"
          description="Fill in your details below. The department will check your entry before it appears on the public alumni page."
        />
        <SubmitForm
          action={boundAction}
          token={token}
          formToken={formToken}
          formRenderedAt={formRenderedAt}
          cohortYear={validation.link.cohortYear}
        />
      </Container>
    </Section>
  );
}
