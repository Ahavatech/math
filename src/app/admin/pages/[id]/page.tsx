import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageEditorForm } from "./page-editor-form";

export default async function AdminPageEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const { id } = await params;
  const [page, media] = await Promise.all([
    db.page.findUnique({ where: { id } }),
    db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  if (!page) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold">Edit: {page.title}</h1>
      <PageEditorForm page={page} existingMedia={media} />
    </div>
  );
}
