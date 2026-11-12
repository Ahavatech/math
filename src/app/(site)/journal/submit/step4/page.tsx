import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db as prisma } from "@/lib/db";
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
        <h1 className="mb-6 border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance">Author agreement</h1>

        <div className="mt-4 border border-border bg-secondary p-4">
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
