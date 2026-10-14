import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listArticlesAdmin } from "@/server/services/journal-articles";
import { Button } from "@/components/ui/button";

export default async function JournalArticlesPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.edit")) {
    redirect("/403");
  }

  const articles = await listArticlesAdmin(db);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Journal articles</h1>
        <Link href="/admin/journal/articles/new"><Button>New article</Button></Link>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {articles.map((article) => (
          <li key={article.id} className="p-3 text-sm">
            <Link href={`/admin/journal/articles/${article.id}`} className="font-medium text-primary underline">
              {article.title || "(untitled)"}
            </Link>
            <p className="text-muted-foreground">
              {article.status}
              {article.issue ? ` - Vol. ${article.issue.volume}, No. ${article.issue.number}` : " - online first"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
