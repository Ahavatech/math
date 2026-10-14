import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveStep1Action } from "@/server/actions/manuscript-submission";

export function generateMetadata() {
  return { title: "Step 1: Article Details" };
}

export default async function SubmitStep1Page({
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
    },
  });

  if (!ms || ms.submittedById !== session.user.id || ms.status !== "INCOMPLETE") {
    redirect("/journal/submit");
  }

  const ARTICLE_TYPES = [
    { value: "RESEARCH_ARTICLE", label: "Research article" },
    { value: "REVIEW", label: "Review" },
    { value: "SHORT_COMMUNICATION", label: "Short communication" },
    { value: "OTHER", label: "Other" },
  ];

  return (
    <Section>
      <Container className="max-w-2xl">
        <p className="text-muted-foreground mb-1 text-sm">Step 1 of 5</p>
        <h1 className="font-heading text-2xl font-semibold">Article details</h1>
        <form action={saveStep1Action} className="mt-6 space-y-5">
          <input type="hidden" name="draftId" value={ms.id} />

          <div className="space-y-1">
            <Label htmlFor="articleType">Article type</Label>
            <select
              id="articleType"
              name="articleType"
              defaultValue={ms.articleType ?? "RESEARCH_ARTICLE"}
              className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              required
            >
              {ARTICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={ms.title} required maxLength={300} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="abstract">Abstract</Label>
            <Textarea
              id="abstract"
              name="abstract"
              defaultValue={ms.abstract}
              required
              maxLength={3000}
              rows={6}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="keywords">Keywords (comma-separated, 3 to 10)</Label>
            <Input
              id="keywords"
              name="keywords"
              defaultValue={ms.keywords.join(", ")}
              placeholder="algebra, topology, analysis"
              required
            />
          </div>

          <Button type="submit">Save and continue</Button>
        </form>
      </Container>
    </Section>
  );
}
