import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { getIssueAdmin } from "@/server/services/journal-issues";
import { IssueForm } from "../issue-form";

export default async function JournalIssueEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.edit")) {
    redirect("/403");
  }

  const { id } = await params;
  let issue;
  try {
    issue = await getIssueAdmin(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-lg font-semibold">Edit issue</h1>
      <IssueForm
        issue={{
          id: issue.id,
          volume: issue.volume,
          number: issue.number,
          year: issue.year,
          title: issue.title,
          description: issue.description,
          status: issue.status,
          cover: issue.cover ? { url: issue.cover.url, alt: issue.cover.alt } : null,
        }}
      />
    </div>
  );
}
