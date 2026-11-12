import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { StatusTag, type StatusTone } from "@/components/journal/status-tag";
import { getReviewerAssignments, getReviewerAcknowledgementOptIn } from "@/server/services/reviewer-dashboard";
import { AcknowledgementToggle } from "./acknowledgement-toggle";

export function generateMetadata() {
  return { title: "Reviewer Dashboard" };
}

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Pending review",
  SUBMITTED: "Review submitted",
};

const STATUS_TONE: Record<string, StatusTone> = {
  ACCEPTED: "action",
  SUBMITTED: "done",
};

export default async function ReviewerDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fjournal%2Freviewer");

  const user = session.user;
  if (!hasRole(user, "REVIEWER")) {
    redirect("/journal/dashboard");
  }

  const [assignments, optIn] = await Promise.all([
    getReviewerAssignments(db, user),
    getReviewerAcknowledgementOptIn(db, user),
  ]);

  return (
    <Section>
      <Container>
        <PageHeader title="Reviewer dashboard" />
        <AcknowledgementToggle initialOptIn={optIn} />
        {assignments.length === 0 ? (
          <p className="mt-8 border-t border-border py-5 text-muted-foreground">You have no active review assignments.</p>
        ) : (
          <div className="mt-8 max-w-4xl border-b border-border">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 border-t border-border py-4"
              >
                <div>
                  <p className="tabular font-heading text-lg font-semibold">Reference: {a.reference}</p>
                  <p className="tabular text-muted-foreground">
                    Round {a.roundNumber}
                    {a.dueAt && (
                      <> &middot; Due {new Date(a.dueAt).toLocaleDateString()}</>
                    )}
                    {a.submittedAt && (
                      <> &middot; Submitted {new Date(a.submittedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
                  <StatusTag tone={STATUS_TONE[a.status] ?? "neutral"}>{STATUS_LABEL[a.status] ?? a.status}</StatusTag>
                  {a.status === "ACCEPTED" && (
                    <Link
                      href={`/journal/reviewer/assignments/${a.id}`}
                      className="link-rule py-2 font-medium text-primary"
                    >
                      {a.hasDraft ? "Continue review" : "Start review"}
                    </Link>
                  )}
                  {a.status === "SUBMITTED" && (
                    <Link
                      href={`/journal/reviewer/assignments/${a.id}`}
                      className="link-rule py-2 font-medium text-muted-foreground"
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
