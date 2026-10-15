import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { listIssuesAdmin } from "@/server/services/journal-issues";
import { Button } from "@/components/ui/button";
import { archiveIssueAction } from "@/server/actions/journal-issues";
import { ArchiveButton } from "./archive-button";

export default async function JournalIssuesPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.edit")) {
    redirect("/403");
  }

  const issues = await listIssuesAdmin();

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Journal issues</h1>
        <Link href="/admin/journal/issues/new"><Button>New issue</Button></Link>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {issues.map((issue) => (
          <li key={issue.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <Link href={`/admin/journal/issues/${issue.id}`} className="font-medium text-primary underline">
                Vol. {issue.volume}, No. {issue.number} ({issue.year}){issue.title ? ` - ${issue.title}` : ""}
              </Link>
              <p className="text-muted-foreground">{issue.status} - {issue._count.articles} article(s)</p>
            </div>
            {issue.status !== "ARCHIVED" ? <ArchiveButton id={issue.id} action={archiveIssueAction} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
