import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getNonTeachingStaffById } from "@/server/services/non-teaching-staff";
import { StaffForm } from "../staff-form";

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "lecturers.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  let staff;
  try {
    staff = await getNonTeachingStaffById(db, id);
  } catch {
    notFound();
  }

  const existingMedia = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 });

  return <StaffForm staff={staff} existingMedia={existingMedia} />;
}
