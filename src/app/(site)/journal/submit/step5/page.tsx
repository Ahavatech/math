import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db as prisma } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { getJournalSettingsPublic } from "@/server/services/journal-settings";
import { submitDraftAction } from "@/server/actions/manuscript-submission";

export function generateMetadata() {
  return { title: "Step 5: Review and Submit" };
}

export default async function SubmitStep5Page({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/journal/login?next=/journal/submit");

  const { draft: draftId } = await searchParams;
  if (!draftId) redirect("/journal/submit");

  const ms = await prisma.manuscript.findUnique({
    where: { id: draftId },
    select: {
      id: true,
      submittedById: true,
      status: true,
      articleType: true,
      title: true,
      abstract: true,
      keywords: true,
      coverLetter: true,
      authors: { orderBy: { order: "asc" } },
      files: { select: { id: true, kind: true, originalName: true, size: true } },
      agreementVersion: true,
    },
  });

  if (!ms || ms.submittedById !== session.user.id || ms.status !== "INCOMPLETE") {
    redirect("/journal/submit");
  }

  const settings = await getJournalSettingsPublic();
  const hasManuscriptFile = ms.files.some((f) => f.kind === "MANUSCRIPT");

  const ARTICLE_TYPE_LABELS: Record<string, string> = {
    RESEARCH_ARTICLE: "Research article",
    REVIEW: "Review",
    SHORT_COMMUNICATION: "Short communication",
    OTHER: "Other",
  };

  return (
    <Section>
      <Container className="max-w-2xl">
        <p className="text-muted-foreground mb-1 text-sm">Step 5 of 5</p>
        <h1 className="font-heading text-2xl font-semibold">Review and submit</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Please review your submission before submitting. You cannot make changes after submission.
        </p>

        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="font-medium">Article type</dt>
            <dd className="text-muted-foreground">{ARTICLE_TYPE_LABELS[ms.articleType ?? "OTHER"] ?? ms.articleType}</dd>
          </div>
          <div>
            <dt className="font-medium">Title</dt>
            <dd className="text-muted-foreground">{ms.title}</dd>
          </div>
          <div>
            <dt className="font-medium">Keywords</dt>
            <dd className="text-muted-foreground">{ms.keywords.join(", ")}</dd>
          </div>
          <div>
            <dt className="font-medium">Authors</dt>
            <dd className="text-muted-foreground">
              {ms.authors.map((a) => `${a.name}${a.isCorresponding ? " (corresponding)" : ""}`).join(", ")}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Manuscript file</dt>
            <dd className="text-muted-foreground">
              {hasManuscriptFile
                ? ms.files.find((f) => f.kind === "MANUSCRIPT")?.originalName
                : <span className="text-destructive">No manuscript file uploaded</span>}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Author agreement</dt>
            <dd className="text-muted-foreground">{ms.agreementVersion ? "Accepted" : "Not accepted"}</dd>
          </div>
        </dl>

        <form action={submitDraftAction} className="mt-8">
          <input type="hidden" name="draftId" value={ms.id} />
          <Button
            type="submit"
            disabled={!hasManuscriptFile || !ms.agreementVersion || !settings.submissionsOpen}
          >
            Submit manuscript
          </Button>
          {!settings.submissionsOpen && (
            <p className="text-destructive mt-2 text-sm">Submissions are currently closed.</p>
          )}
          {!hasManuscriptFile && (
            <p className="text-destructive mt-2 text-sm">
              A manuscript file must be uploaded before submitting. Go back to step 3.
            </p>
          )}
        </form>
      </Container>
    </Section>
  );
}
