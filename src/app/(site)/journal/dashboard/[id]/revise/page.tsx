import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { FileUploader } from "@/components/journal/file-uploader";
import { RevisionForm } from "@/components/journal/revision-form";
import { Button } from "@/components/ui/button";
import { resubmitReturnedAction } from "@/server/actions/manuscript-submission";
import { getRevisionState } from "@/server/services/manuscript-revision";

export function generateMetadata() {
  return { title: "Revise and resubmit" };
}

export default async function RevisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/journal/dashboard/${id}/revise`)}`);
  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/login?callbackUrl=%2Fjournal%2Fdashboard");
  }

  const state = await getRevisionState(prisma, user.id, id).catch(() => null);
  if (!state) notFound();
  const returned = state.manuscript.status === "RETURNED_TO_AUTHOR";
  if (!returned && (state.manuscript.status !== "REVISION_REQUESTED" || !state.round)) {
    redirect(`/journal/dashboard/${id}`);
  }

  if (returned) {
    const current = await prisma.manuscriptFile.findFirst({
      where: { manuscriptId: id, kind: "MANUSCRIPT" },
      select: { originalName: true },
    });
    return (
      <Section>
        <Container className="max-w-2xl">
          <Link href={`/journal/dashboard/${id}`} className="text-muted-foreground text-sm underline">
            Back to this submission
          </Link>
          <h1 className="mt-4 mb-2 border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance">
            Correct and resubmit
          </h1>
          <p className="text-muted-foreground text-sm">
            {state.manuscript.reference ?? ""} {state.manuscript.title ? `· ${state.manuscript.title}` : ""}
          </p>
          <p className="mt-4 text-sm">
            Read the editor&apos;s message on the submission page, replace your manuscript file with the corrected
            one, then send it again.
          </p>
          <FileUploader
            manuscriptId={id}
            kind="MANUSCRIPT"
            label="Corrected manuscript (PDF or DOCX)"
            currentName={current?.originalName}
          />
          <form action={resubmitReturnedAction} className="mt-6">
            <input type="hidden" name="manuscriptId" value={id} />
            <Button type="submit">Resubmit</Button>
          </form>
        </Container>
      </Section>
    );
  }

  const files = state.round?.files ?? [];
  const revised = files.find((f) => f.kind === "REVISED");
  const reply = files.find((f) => f.kind === "RESPONSE_TO_REVIEWERS");

  return (
    <Section>
      <Container className="max-w-2xl">
        <Link href={`/journal/dashboard/${id}`} className="text-muted-foreground text-sm underline">
          Back to this submission
        </Link>
        <h1 className="mt-4 mb-2 border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance">
          Revise and resubmit
        </h1>
        <p className="text-muted-foreground text-sm">
          {state.manuscript.reference ?? ""} {state.manuscript.title ? `· ${state.manuscript.title}` : ""}
        </p>
        <p className="mt-4 text-sm">
          Upload your revised manuscript and write your response to the reviewers. Remove author names and
          affiliations from the revised file, as before. Nothing reaches the editor until you press Send revision.
        </p>

        <FileUploader
          manuscriptId={id}
          kind="REVISED"
          label="Revised manuscript (PDF or DOCX)"
          currentName={revised?.originalName}
        />
        <FileUploader
          manuscriptId={id}
          kind="RESPONSE_TO_REVIEWERS"
          label="Response letter as a file (optional)"
          currentName={reply?.originalName}
        />

        <RevisionForm
          manuscriptId={id}
          defaultResponse={state.round?.responseToReviewers ?? ""}
          hasRevisedFile={Boolean(revised)}
        />
      </Container>
    </Section>
  );
}
