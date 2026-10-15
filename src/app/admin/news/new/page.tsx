import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { NewsForm } from "../news-form";

export default async function NewNewsPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "news.manage")) {
    redirect("/403");
  }

  const existingMedia = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 });
  return <NewsForm post={null} existingMedia={existingMedia} />;
}
