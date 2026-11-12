import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { getJournalSettingsPublic } from "@/server/services/journal-settings";
import { createOrOpenDraftAction } from "@/server/actions/manuscript-submission";

export function generateMetadata() {
  return { title: "Submit a Manuscript" };
}

export default async function JournalSubmitPage() {
  const settings = await getJournalSettingsPublic();

  if (!settings.submissionsOpen) {
    return (
      <Section>
        <Container className="max-w-2xl">
          <h1 className="mb-6 border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance">Submissions are currently closed</h1>
          <p className="text-muted-foreground mt-2">
            The journal is not currently accepting new submissions. Please check back later or
            contact the editorial team for more information.
          </p>
        </Container>
      </Section>
    );
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fjournal%2Fsubmit");
  }

  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/journal/register?next=/journal/submit");
  }

  return (
    <Section>
      <Container className="max-w-2xl">
        <h1 className="mb-6 border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance">Submit a manuscript</h1>
        <p className="text-muted-foreground mt-2">
          You will be guided through a 5-step submission process. You can save your progress at
          each step.
        </p>
        <form action={createOrOpenDraftAction} className="mt-6">
          <Button type="submit">Start submission</Button>
        </form>
      </Container>
    </Section>
  );
}
