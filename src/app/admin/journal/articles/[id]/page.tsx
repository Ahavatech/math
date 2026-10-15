import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getArticleAdmin } from "@/server/services/journal-articles";
import { ArticleForm } from "../article-form";

export default async function JournalArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.edit")) {
    redirect("/403");
  }

  const { id } = await params;
  let article;
  try {
    article = await getArticleAdmin(db, id);
  } catch {
    notFound();
  }

  const issues = await db.journalIssue.findMany({ select: { id: true, volume: true, number: true }, orderBy: [{ year: "desc" }] });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-lg font-semibold">Edit article</h1>
      <ArticleForm
        issues={issues}
        article={{
          id: article.id,
          title: article.title,
          abstract: article.abstract,
          keywords: article.keywords,
          authors: article.authors.map((a) => ({
            name: a.name,
            affiliation: a.affiliation ?? "",
            orcid: a.orcid ?? "",
            email: a.email ?? "",
            userId: a.userId ?? "",
          })),
          issueId: article.issueId,
          pageStart: article.pageStart,
          pageEnd: article.pageEnd,
          type: article.type,
          doi: article.doi ?? "",
          license: article.license ?? "",
          receivedAt: article.receivedAt?.toISOString() ?? null,
          acceptedAt: article.acceptedAt?.toISOString() ?? null,
          status: article.status,
          hasPdf: !!article.pdfDownloadId,
        }}
      />
    </div>
  );
}
