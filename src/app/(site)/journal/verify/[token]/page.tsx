import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyEmail } from "@/server/services/author-registration";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import Link from "next/link";

export function generateMetadata() {
  return { title: "Verify your email" };
}

export default async function JournalVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { token } = await params;
  const { next } = await searchParams;

  const result = await verifyEmail(db, token);

  if (!result) {
    return (
      <Section>
        <Container className="max-w-md">
          <div className="space-y-3">
            <h1 className="mb-6 border-b-2 border-foreground pb-4 font-heading text-4xl leading-[1.08] font-semibold text-balance">Verification link expired</h1>
            <p className="text-muted-foreground text-sm">
              This verification link is invalid or has already been used. Please register
              again or sign in if you have already verified your email.
            </p>
            <p className="text-sm">
              <Link href="/journal/register" className="underline">
                Register again
              </Link>{" "}
              or{" "}
              <Link href="/login?callbackUrl=%2Fjournal%2Fdashboard" className="underline">
                sign in
              </Link>
            </p>
          </div>
        </Container>
      </Section>
    );
  }

  // Redirect to the dashboard (or a validated next path)
  const { validateNextParam } = await import("@/server/services/author-registration");
  redirect(validateNextParam(next));
}
