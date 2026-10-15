import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db as prisma } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveStep3Action } from "@/server/actions/manuscript-submission";

export function generateMetadata() {
  return { title: "Step 3: Files and Cover Letter" };
}

export default async function SubmitStep3Page({
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
      coverLetter: true,
      files: { select: { id: true, kind: true, originalName: true, size: true } },
    },
  });

  if (!ms || ms.submittedById !== session.user.id || ms.status !== "INCOMPLETE") {
    redirect("/journal/submit");
  }

  const manuscriptFile = ms.files.find((f) => f.kind === "MANUSCRIPT");

  return (
    <Section>
      <Container className="max-w-2xl">
        <p className="text-muted-foreground mb-1 text-sm">Step 3 of 5</p>
        <h1 className="font-heading text-2xl font-semibold">Files and cover letter</h1>

        <div className="mt-4 rounded-lg border p-4">
          <p className="font-medium text-sm">Manuscript file (PDF or DOCX)</p>
          {manuscriptFile ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Uploaded: {manuscriptFile.originalName} ({Math.round(manuscriptFile.size / 1024)} KB)
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">No file uploaded yet.</p>
          )}
          {/* JS upload target — graceful degradation via direct form POST */}
          <form
            method="POST"
            action={`/api/journal/manuscripts/${ms.id}/files`}
            encType="multipart/form-data"
            className="mt-3"
          >
            <input type="hidden" name="X-File-Kind" value="MANUSCRIPT" />
            <Label htmlFor="ms-file" className="sr-only">
              Upload manuscript
            </Label>
            <input
              id="ms-file"
              type="file"
              name="file"
              accept=".pdf,.docx"
              className="text-sm"
            />
            <Button type="submit" variant="outline" size="sm" className="mt-2">
              Upload file
            </Button>
          </form>
        </div>

        <form action={saveStep3Action} className="mt-6 space-y-5">
          <input type="hidden" name="draftId" value={ms.id} />

          <div className="space-y-1">
            <Label htmlFor="coverLetter">Cover letter</Label>
            <Textarea
              id="coverLetter"
              name="coverLetter"
              defaultValue={ms.coverLetter ?? ""}
              required
              maxLength={5000}
              rows={8}
              placeholder="Briefly describe why your manuscript is suitable for the journal..."
            />
          </div>

          <div className="space-y-1">
            <p className="font-medium text-sm">Anonymisation confirmation</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="hidden" name="anonymisedConfirmed" value="false" />
              <input type="checkbox" name="anonymisedConfirmed" value="true" required />
              <span>I confirm that the manuscript file does not contain author names or institutional affiliations (blind review).</span>
            </label>
          </div>

          <Button type="submit">Save and continue</Button>
        </form>
      </Container>
    </Section>
  );
}
