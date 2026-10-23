import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getReviewerAssignments, getReviewerAcknowledgementOptIn } from "@/server/services/reviewer-dashboard";
import { AcknowledgementToggle } from "./acknowledgement-toggle";

export function generateMetadata() {
  return { title: "Reviewer Dashboard" };
}

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Pending review",
  SUBMITTED: "Review submitted",
};

const STATUS_CLASS: Record<string, string> = {
  ACCEPTED: "bg-yellow-100 text-yellow-800",
  SUBMITTED: "bg-green-100 text-green-800",
};

export default async function ReviewerDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/journal/login?next=/journal/reviewer");

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
        <h1 className="text-2xl font-bold mb-6">Reviewer dashboard</h1>
        <AcknowledgementToggle initialOptIn={optIn} />
        {assignments.length === 0 ? (
          <p className="text-muted-foreground">You have no active review assignments.</p>
        ) : (
          <div className="space-y-4">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="border rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium">Reference: {a.reference}</p>
                  <p className="text-sm text-muted-foreground">
                    Round {a.roundNumber}
                    {a.dueAt && (
                      <> &middot; Due {new Date(a.dueAt).toLocaleDateString()}</>
                    )}
                    {a.submittedAt && (
                      <> &middot; Submitted {new Date(a.submittedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_CLASS[a.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  {a.status === "ACCEPTED" && (
                    <Link
                      href={`/journal/reviewer/assignments/${a.id}`}
                      className="text-sm font-medium underline"
                    >
                      {a.hasDraft ? "Continue review" : "Start review"}
                    </Link>
                  )}
                  {a.status === "SUBMITTED" && (
                    <Link
                      href={`/journal/reviewer/assignments/${a.id}`}
                      className="text-sm text-muted-foreground underline"
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
