import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listNonTeachingStaffAdmin } from "@/server/services/non-teaching-staff";
import { getSetting } from "@/server/services/site-settings";
import { Button } from "@/components/ui/button";
import { StaffRow } from "./staff-row";

export default async function AdminStaffPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "lecturers.manage")) {
    redirect("/403");
  }

  const [staff, importFlags] = await Promise.all([
    listNonTeachingStaffAdmin(db),
    getSetting(db, "staff.importFlags"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Non-teaching staff</h1>
        <Button render={<Link href="/admin/staff/new">New staff member</Link>} />
      </div>
      <ul className="space-y-2">
        {staff.map((member) => (
          <StaffRow key={member.id} staff={member} needsReview={Boolean(importFlags[member.id])} />
        ))}
        {staff.length === 0 ? <p className="text-sm text-muted-foreground">No non-teaching staff yet.</p> : null}
      </ul>
    </div>
  );
}
