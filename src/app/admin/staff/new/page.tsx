import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { StaffForm } from "../staff-form";

export default async function NewStaffPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "lecturers.manage")) {
    redirect("/403");
  }

  const existingMedia = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 });

  return <StaffForm staff={null} existingMedia={existingMedia} />;
}
