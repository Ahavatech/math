import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ResearchAreaForm } from "../research-area-form";

export default async function EditResearchAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "academics.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  const [area, existingMedia] = await Promise.all([
    db.researchArea.findUnique({ where: { id }, include: { image: true } }),
    db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  if (!area) notFound();

  return <ResearchAreaForm area={area} existingMedia={existingMedia} />;
}
