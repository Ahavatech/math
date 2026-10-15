import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HandbookForm } from "../handbook-form";

export default async function EditHandbookPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  const page = await db.handbookPage.findUnique({ where: { id } });
  if (!page) notFound();

  const topLevelPages = await db.handbookPage.findMany({ where: { parentId: null }, select: { id: true, title: true } });

  return <HandbookForm page={page} topLevelPages={topLevelPages} />;
}
