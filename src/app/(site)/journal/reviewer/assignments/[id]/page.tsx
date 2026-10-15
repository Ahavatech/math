import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getReviewAssignmentDetail } from "@/server/services/reviewer-dashboard";
import { ReviewForm } from "./review-form";

export function generateMetadata() {
  return { title: "Review assignment" };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReviewAssignmentPage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect(`/journal/login?next=/journal/reviewer/assignments/${id}`);

  const user = session.user;
  if (!hasRole(user, "REVIEWER")) redirect("/journal/dashboard");

  const assignment = await getReviewAssignmentDetail(db, user, id).catch(() => null);
  if (!assignment) notFound();

  const isSubmitted = assignment.status === "SUBMITTED";
  const review = assignment.review;

  // Files visible to reviewer: all except TITLE_PAGE (enforced in the service query)
  const roundNumber = assignment.round?.number ?? 1;
  const files = assignment.manuscript.files.filter(
    (f) => f.roundId != null,
  );

  return (
    <Section>
      <Container className="max-w-3xl">
        <div className="mb-6">
          <Link href="/journal/reviewer" className="text-sm text-muted-foreground hover:underline">
            &larr; Back to dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">Review assignment</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Reference: {assignment.manuscript.reference ?? id} &middot; Round{" "}
          {roundNumber}
        </p>

        {files.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Manuscript files</h2>
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id}>
                  <a
                    href={`/api/journal/manuscripts/${assignment.manuscriptId}/files/${f.id}`}
                    className="text-sm underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {f.originalName} ({f.kind})
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-4">Your review</h2>
        <ReviewForm
          assignmentId={id}
          initialData={
            review
              ? {
                  recommendation: review.recommendation ?? undefined,
                  commentsToAuthor: review.commentsToAuthor ?? undefined,
                  commentsToEditor: review.commentsToEditor ?? undefined,
                }
              : undefined
          }
          isSubmitted={isSubmitted}
        />
      </Container>
    </Section>
  );
}
