import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { StatusTag, type StatusTone } from "@/components/journal/status-tag";
import { getAuthorManuscripts } from "@/server/services/author-dashboard";

export function generateMetadata() {
  return { title: "My Submissions" };
}

const STATUS_TONE: Record<string, StatusTone> = {
  INCOMPLETE: "neutral",
  SUBMITTED: "neutral",
  SCREENING: "neutral",
  RETURNED_TO_AUTHOR: "action",
  REVISION_REQUESTED: "action",
  UNDER_REVIEW: "neutral",
  ACCEPTED: "done",
  PUBLISHED: "done",
  REJECTED: "bad",
  WITHDRAWN: "neutral",
};

export default async function JournalDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fjournal%2Fdashboard");
  }

  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/login?callbackUrl=%2Fjournal%2Fdashboard");
  }

  const manuscripts = await getAuthorManuscripts(prisma, user.id);

  return (
    <Section>
      <Container>
        <PageHeader
          title="My submissions"
          actions={
            <Link
              href="/journal/submit"
              className="inline-flex min-h-12 items-center bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground"
            >
              New submission
            </Link>
          }
        />

        {manuscripts.length === 0 ? (
          <p className="mt-8 border-t border-border py-5 text-muted-foreground">
            You have no submissions yet.{" "}
            <Link href="/journal/submit" className="link-rule font-medium text-primary">
              Start a new submission
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 max-w-4xl border-b border-border">
            {manuscripts.map((ms) => (
              <li key={ms.id} className="flex items-center justify-between gap-4 border-t border-border py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-lg font-semibold">{ms.title || "Untitled draft"}</p>
                  <p className="tabular mt-0.5 text-sm text-muted-foreground">
                    {ms.reference ?? "No reference yet"}
                    {ms.submittedAt && ` · Submitted ${new Date(ms.submittedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
                  <StatusTag tone={STATUS_TONE[ms.status] ?? "neutral"}>{ms.plainLanguageStatus}</StatusTag>
                  <Link
                    href={`/journal/dashboard/${ms.id}`}
                    className="link-rule py-2 font-medium text-primary"
                  >
                    View
                  </Link>
                  {ms.status === "INCOMPLETE" && (
                    <Link
                      href={`/journal/submit/step1?draft=${ms.id}`}
                      className="link-rule py-2 font-medium text-primary"
                    >
                      Continue
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
