import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HandbookForm } from "../handbook-form";

export default async function NewHandbookPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const topLevelPages = await db.handbookPage.findMany({ where: { parentId: null }, select: { id: true, title: true } });

  return <HandbookForm page={null} topLevelPages={topLevelPages} />;
}
