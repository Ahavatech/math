import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { IssueForm } from "../issue-form";

export default async function NewJournalIssuePage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.edit")) {
    redirect("/403");
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-lg font-semibold">New issue</h1>
      <IssueForm />
    </div>
  );
}
