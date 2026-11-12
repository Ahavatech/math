import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getAuthorManuscriptDetail } from "@/server/services/author-dashboard";
import { getReviewsForAuthor } from "@/server/services/review-visibility";

export function generateMetadata() {
  return { title: "Submission detail" };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const EVENT_LABELS: Record<string, string> = {
  SUBMITTED: "Submission received",
  EDITOR_ASSIGNED: "Editor assigned",
  RETURNED_TO_AUTHOR: "Returned for revisions",
  RESUBMITTED: "Resubmission received",
  DESK_REJECTED: "Decision: not accepted",
  APPROVED_FOR_REVIEW: "Sent for peer review",
  WITHDRAWN: "Withdrawn",
};

export default async function ManuscriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fjournal%2Fdashboard");
  }

  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/login?callbackUrl=%2Fjournal%2Fdashboard");
  }

  const { id } = await params;

  const ms = await getAuthorManuscriptDetail(prisma, user.id, id).catch(() => null);
  if (!ms) notFound();

  // Reviewer comments (only visible when status warrants it)
  const sessionUser = { id: user.id, roles: user.roles, isActive: user.isActive ?? true };
  const authorReviews = await getReviewsForAuthor(prisma, sessionUser, id).catch(() => []);

  // Latest editorial decision for this manuscript
  const latestDecision = await prisma.editorialDecision.findFirst({
    where: { manuscriptId: id },
    orderBy: { decidedAt: "desc" },
    select: { decision: true, letterHtml: true, decidedAt: true },
  });

  return (
    <Section>
      <Container className="max-w-3xl">
        <Link href="/journal/dashboard" className="text-muted-foreground text-sm underline">
          Back to my submissions
        </Link>

        <div className="mt-4">
          <h1 className="mb-6 border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance">{ms.title || "Untitled draft"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {ms.reference ?? "Not yet submitted"} &middot; {ms.plainLanguageStatus}
          </p>
        </div>

        {/* Files */}
        {ms.files.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading text-xl font-semibold">Files</h2>
            <ul className="mt-2 space-y-1">
              {ms.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {f.originalName} ({formatBytes(f.size)})
                  </span>
                  <a
                    href={`/api/journal/files/${f.id}`}
                    className="text-primary ml-4 underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Timeline */}
        {ms.events.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading text-xl font-semibold">Timeline</h2>
            <ol className="mt-2 space-y-2">
              {ms.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </span>
                  {e.note && <p className="text-muted-foreground mt-0.5">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Rejection letter (desk reject / return) */}
        {ms.rejectionLetter && (
          <section className="mt-6">
            <h2 className="font-heading text-xl font-semibold">Editor message</h2>
            <div className="mt-2 border border-border bg-secondary p-4">
              <p className="whitespace-pre-wrap text-sm">{ms.rejectionLetter}</p>
            </div>
          </section>
        )}

        {/* Decision letter (from peer review round) */}
        {latestDecision?.letterHtml && !ms.rejectionLetter && (
          <section className="mt-6">
            <h2 className="font-heading text-xl font-semibold">
              Editorial decision: {latestDecision.decision.replace(/_/g, " ").toLowerCase()}
            </h2>
            <div
              className="prose prose-sm mt-2 max-w-none border border-border bg-secondary p-4"
              dangerouslySetInnerHTML={{ __html: latestDecision.letterHtml }}
            />
          </section>
        )}

        {/* Reviewer comments (author view: labels only, no reviewer identity) */}
        {authorReviews.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading text-xl font-semibold">Reviewer comments</h2>
            <div className="mt-3 space-y-4">
              {authorReviews.map((r) => (
                <div key={r.label} className="border border-border p-4">
                  <p className="font-medium mb-2">
                    {r.label}
                    {r.recommendation && (
                      <span className="text-muted-foreground ml-2 font-normal">
                        ({r.recommendation.replace(/_/g, " ").toLowerCase()})
                      </span>
                    )}
                  </p>
                  {r.commentsToAuthorHtml ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: r.commentsToAuthorHtml }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">No comments provided.</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        {ms.status === "RETURNED_TO_AUTHOR" && (
          <section className="mt-6">
            <Link
              href={`/journal/submit/step1?draft=${ms.id}`}
              className="inline-flex min-h-12 items-center bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground disabled:opacity-50"
            >
              Upload corrected files and resubmit
            </Link>
          </section>
        )}

        {/* Revision upload for REVISION_REQUESTED */}
        {ms.status === "REVISION_REQUESTED" && (
          <section className="mt-6 border-2 border-accent bg-secondary p-4">
            <h2 className="font-heading text-xl font-semibold text-accent mb-1">Revision requested</h2>
            <p className="mb-3 text-accent">
              Please review the editor decision letter and reviewer comments above, then upload your
              revised manuscript.
            </p>
            <Link
              href={`/journal/submit/step1?draft=${ms.id}&revision=1`}
              className="inline-flex min-h-12 items-center bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground disabled:opacity-50"
            >
              Upload revised manuscript
            </Link>
          </section>
        )}
      </Container>
    </Section>
  );
}
