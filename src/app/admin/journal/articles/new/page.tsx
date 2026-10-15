import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ArticleForm } from "../article-form";

export default async function NewJournalArticlePage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.edit")) {
    redirect("/403");
  }

  const issues = await db.journalIssue.findMany({ select: { id: true, volume: true, number: true }, orderBy: [{ year: "desc" }] });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-lg font-semibold">New article</h1>
      <ArticleForm issues={issues} />
    </div>
  );
}
