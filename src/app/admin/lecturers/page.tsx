import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listLecturersAdmin } from "@/server/services/lecturers";
import { Button } from "@/components/ui/button";
import { CreateLecturerForm } from "./create-lecturer-form";
import { LecturerRow } from "./lecturer-row";

export default async function AdminLecturersPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "lecturers.manage")) {
    redirect("/403");
  }

  const [lecturers, researchAreaCounts] = await Promise.all([
    listLecturersAdmin(db),
    db.lecturerProfile.findMany({ select: { id: true, _count: { select: { researchAreas: true } } } }),
  ]);
  const countsById = new Map(researchAreaCounts.map((p) => [p.id, p._count.researchAreas]));

  const awaitingPublishing = lecturers.filter((l) => l.publishRequestedAt && l.status !== "PUBLISHED").length;
  const invitesNotAccepted = lecturers.filter((l) => l.inviteState === "invited" || l.inviteState === "expired").length;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Lecturers</h1>
        <Button render={<Link href="/admin/lecturers/import" />}>Bulk import (CSV)</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border p-4">
          <p className="text-2xl font-semibold">{awaitingPublishing}</p>
          <p className="text-sm text-muted-foreground">Profiles awaiting publishing</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-2xl font-semibold">{invitesNotAccepted}</p>
          <p className="text-sm text-muted-foreground">Invites not yet accepted</p>
        </div>
      </div>

      <CreateLecturerForm />

      <ul className="space-y-2">
        {lecturers.map((lecturer) => (
          <LecturerRow
            key={lecturer.id}
            lecturer={lecturer}
            completeness={(() => {
              const checks = [lecturer.photoId !== null, Boolean(lecturer.bio?.trim()), (countsById.get(lecturer.id) ?? 0) > 0];
              return Math.round((checks.filter(Boolean).length / checks.length) * 100);
            })()}
          />
        ))}
        {lecturers.length === 0 ? <p className="text-sm text-muted-foreground">No lecturers yet.</p> : null}
      </ul>
    </div>
  );
}
