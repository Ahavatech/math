import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { saveStep4Action } from "@/server/actions/manuscript-submission";
import { JOURNAL_AUTHOR_AGREEMENT_V1_TEXT } from "@/lib/constants";

export function generateMetadata() {
  return { title: "Step 4: Author Agreement" };
}

export default async function SubmitStep4Page({
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
    select: { id: true, submittedById: true, status: true },
  });

  if (!ms || ms.submittedById !== session.user.id || ms.status !== "INCOMPLETE") {
    redirect("/journal/submit");
  }

  return (
    <Section>
      <Container className="max-w-2xl">
        <p className="text-muted-foreground mb-1 text-sm">Step 4 of 5</p>
        <h1 className="font-heading text-2xl font-semibold">Author agreement</h1>

        <div className="bg-muted mt-4 rounded-lg border p-4">
          <pre className="whitespace-pre-wrap text-sm">{JOURNAL_AUTHOR_AGREEMENT_V1_TEXT}</pre>
        </div>

        <form action={saveStep4Action} className="mt-6 space-y-4">
          <input type="hidden" name="draftId" value={ms.id} />

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="agreed" required />
            <span>I have read and agree to the author agreement above.</span>
          </label>

          <Button type="submit">Accept and continue</Button>
        </form>
      </Container>
    </Section>
  );
}
