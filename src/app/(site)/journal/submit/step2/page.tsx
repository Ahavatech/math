import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStep2Action } from "@/server/actions/manuscript-submission";

export function generateMetadata() {
  return { title: "Step 2: Authors" };
}

export default async function SubmitStep2Page({
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
      authors: { orderBy: { order: "asc" } },
    },
  });

  if (!ms || ms.submittedById !== session.user.id || ms.status !== "INCOMPLETE") {
    redirect("/journal/submit");
  }

  const authors = ms.authors.length > 0 ? ms.authors : [{ name: "", affiliation: "", email: "", orcid: "", isCorresponding: true }];

  return (
    <Section>
      <Container className="max-w-2xl">
        <p className="text-muted-foreground mb-1 text-sm">Step 2 of 5</p>
        <h1 className="font-heading text-2xl font-semibold">Authors</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          List all authors. Mark exactly one as corresponding author.
        </p>
        <form action={saveStep2Action} className="mt-6 space-y-6">
          <input type="hidden" name="draftId" value={ms.id} />

          {authors.map((a, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-4">
              <p className="font-medium text-sm">Author {i + 1}</p>
              <div className="space-y-1">
                <Label htmlFor={`author-name-${i}`}>Full name</Label>
                <Input id={`author-name-${i}`} name={`authors[${i}][name]`} defaultValue={a.name} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`author-aff-${i}`}>Affiliation</Label>
                <Input id={`author-aff-${i}`} name={`authors[${i}][affiliation]`} defaultValue={a.affiliation ?? ""} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`author-email-${i}`}>Email</Label>
                <Input id={`author-email-${i}`} type="email" name={`authors[${i}][email]`} defaultValue={a.email ?? ""} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`author-orcid-${i}`}>ORCID</Label>
                <Input id={`author-orcid-${i}`} name={`authors[${i}][orcid]`} defaultValue={a.orcid ?? ""} placeholder="0000-0000-0000-0000" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`corr-${i}`}
                  name="correspondingAuthorIndex"
                  value={String(i)}
                  defaultChecked={a.isCorresponding}
                />
                <Label htmlFor={`corr-${i}`}>Corresponding author</Label>
              </div>
            </div>
          ))}

          <Button type="submit">Save and continue</Button>
        </form>
      </Container>
    </Section>
  );
}
