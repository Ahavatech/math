import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getNewsPostByIdAdmin } from "@/server/services/news";
import { NewsForm } from "../news-form";

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "news.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  let post;
  try {
    post = await getNewsPostByIdAdmin(db, id);
  } catch {
    notFound();
  }

  const existingMedia = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 });
  return <NewsForm post={post} existingMedia={existingMedia} />;
}
