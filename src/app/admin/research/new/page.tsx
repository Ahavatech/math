import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ResearchAreaForm } from "../research-area-form";

export default async function NewResearchAreaPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const existingMedia = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 });

  return <ResearchAreaForm area={null} existingMedia={existingMedia} />;
}
