import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getAuthorManuscripts } from "@/server/services/author-dashboard";

export function generateMetadata() {
  return { title: "My Submissions" };
}

const STATUS_BADGE: Record<string, string> = {
  INCOMPLETE: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-100 text-blue-800",
  SCREENING: "bg-yellow-100 text-yellow-800",
  RETURNED_TO_AUTHOR: "bg-orange-100 text-orange-800",
  UNDER_REVIEW: "bg-purple-100 text-purple-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-muted text-muted-foreground",
};

export default async function JournalDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/journal/login?next=/journal/dashboard");
  }

  const user = session.user;
  if (!hasRole({ id: user.id, roles: user.roles, isActive: user.isActive ?? true }, "AUTHOR")) {
    redirect("/journal/login?next=/journal/dashboard");
  }

  const manuscripts = await getAuthorManuscripts(prisma, user.id);

  return (
    <Section>
      <Container className="max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-semibold">My submissions</h1>
          <Link
            href="/journal/submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
          >
            New submission
          </Link>
        </div>

        {manuscripts.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">
            You have no submissions yet.{" "}
            <Link href="/journal/submit" className="underline">
              Start a new submission
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {manuscripts.map((ms) => (
              <li key={ms.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{ms.title || "Untitled draft"}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {ms.reference ?? "No reference yet"}
                    {ms.submittedAt && ` · Submitted ${new Date(ms.submittedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[ms.status] ?? ""}`}
                  >
                    {ms.plainLanguageStatus}
                  </span>
                  <Link
                    href={`/journal/dashboard/${ms.id}`}
                    className="text-primary text-sm underline"
                  >
                    View
                  </Link>
                  {ms.status === "INCOMPLETE" && (
                    <Link
                      href={`/journal/submit/step1?draft=${ms.id}`}
                      className="text-primary text-sm underline"
                    >
                      Continue
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
