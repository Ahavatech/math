import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getAuthorManuscriptDetail } from "@/server/services/author-dashboard";

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
    redirect("/journal/login?next=/journal/dashboard");
  }

  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/journal/login?next=/journal/dashboard");
  }

  const { id } = await params;

  let ms;
  try {
    ms = await getAuthorManuscriptDetail(prisma, user.id, id);
  } catch {
    notFound();
  }

  return (
    <Section>
      <Container className="max-w-3xl">
        <Link href="/journal/dashboard" className="text-muted-foreground text-sm underline">
          Back to my submissions
        </Link>

        <div className="mt-4">
          <h1 className="font-heading text-2xl font-semibold">{ms.title || "Untitled draft"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {ms.reference ?? "Not yet submitted"} &middot; {ms.plainLanguageStatus}
          </p>
        </div>

        {/* Files */}
        {ms.files.length > 0 && (
          <section className="mt-6">
            <h2 className="font-heading text-base font-semibold">Files</h2>
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
            <h2 className="font-heading text-base font-semibold">Timeline</h2>
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

        {/* Rejection letter */}
        {ms.rejectionLetter && (
          <section className="mt-6">
            <h2 className="font-heading text-base font-semibold">Editor message</h2>
            <div className="bg-muted mt-2 rounded-lg border p-4">
              <p className="whitespace-pre-wrap text-sm">{ms.rejectionLetter}</p>
            </div>
          </section>
        )}

        {/* Actions */}
        {ms.status === "RETURNED_TO_AUTHOR" && (
          <section className="mt-6">
            <Link
              href={`/journal/submit/step1?draft=${ms.id}`}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-md px-4 py-2 text-sm font-medium"
            >
              Upload corrected files and resubmit
            </Link>
          </section>
        )}
      </Container>
    </Section>
  );
}
