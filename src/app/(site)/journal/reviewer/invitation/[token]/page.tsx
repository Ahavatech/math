import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import {
  acceptInvitationAction,
  declineInvitationAction,
} from "@/server/actions/reviewer-invitation";

export function generateMetadata() {
  return { title: "Reviewer Invitation" };
}

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ action?: string; reason?: string }>;
}

export default async function ReviewerInvitationPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { action, reason } = await searchParams;

  const session = await auth();
  if (!session?.user) {
    redirect(`/journal/login?next=/journal/reviewer/invitation/${token}${action ? `?action=${action}` : ""}`);
  }

  if (action === "accept") {
    const result = await acceptInvitationAction(token);
    if (result.error) {
      return (
        <Section>
          <Container>
            <h1 className="text-2xl font-bold mb-4">Invitation error</h1>
            <p className="text-destructive">{result.error}</p>
          </Container>
        </Section>
      );
    }
    redirect("/journal/reviewer");
  }

  if (action === "decline") {
    const result = await declineInvitationAction(token, reason);
    if (result.error) {
      return (
        <Section>
          <Container>
            <h1 className="text-2xl font-bold mb-4">Invitation error</h1>
            <p className="text-destructive">{result.error}</p>
          </Container>
        </Section>
      );
    }
    return (
      <Section>
        <Container>
          <h1 className="text-2xl font-bold mb-4">Invitation declined</h1>
          <p>Thank you for letting us know. The editorial team has been notified.</p>
        </Container>
      </Section>
    );
  }

  // No action: show accept/decline form
  return (
    <Section>
      <Container className="max-w-lg">
        <h1 className="text-2xl font-bold mb-4">Reviewer invitation</h1>
        <p className="mb-6 text-muted-foreground">
          You have been invited to review a manuscript. Please choose whether to accept or decline.
        </p>
        <div className="flex gap-4">
          <form action={`/journal/reviewer/invitation/${token}?action=accept`} method="get">
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
            >
              Accept
            </button>
          </form>
          <form action={`/journal/reviewer/invitation/${token}?action=decline`} method="get">
            <button
              type="submit"
              className="px-4 py-2 border rounded-md font-medium"
            >
              Decline
            </button>
          </form>
        </div>
      </Container>
    </Section>
  );
}
