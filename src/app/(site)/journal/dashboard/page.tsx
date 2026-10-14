import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

export function generateMetadata() {
  return { title: "My Submissions" };
}

export default async function JournalDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/journal/login?next=/journal/dashboard");
  }

  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/journal/login?next=/journal/dashboard");
  }

  return (
    <Section>
      <Container className="max-w-3xl">
        <h1 className="font-heading text-2xl font-semibold">My submissions</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your manuscript submissions will appear here.
        </p>
      </Container>
    </Section>
  );
}
