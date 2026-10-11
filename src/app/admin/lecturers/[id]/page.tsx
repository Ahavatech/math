import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getLecturerById } from "@/server/services/lecturers";
import { adminUpdateLecturerSelfFieldsAction } from "@/server/actions/lecturers";
import { LecturerSelfFieldsForm } from "@/components/admin/lecturer-self-fields-form";
import { AdminFieldsForm } from "./admin-fields-form";

export default async function AdminLecturerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "lecturers.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  let profile;
  try {
    profile = await getLecturerById(db, id);
  } catch {
    notFound();
  }

  const [existingMedia, allResearchAreas] = await Promise.all([
    db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    db.researchArea.findMany({ where: { status: "PUBLISHED" }, orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-heading text-lg font-semibold">{profile.fullName}</h1>

      <AdminFieldsForm
        id={profile.id}
        slug={profile.slug}
        rank={profile.rank}
        status={profile.status}
        order={profile.order}
        isEmeritus={profile.isEmeritus}
      />

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Profile (editing on this lecturer&apos;s behalf)</h2>
        <LecturerSelfFieldsForm
          value={{
            photoId: profile.photoId,
            honorific: profile.honorific ?? "",
            bio: profile.bio ?? "",
            researchAreaIds: profile.researchAreas.map((a) => a.id),
            officeLocation: profile.officeLocation ?? "",
            officeHours: profile.officeHours ?? "",
            publicEmail: profile.publicEmail ?? "",
            phone: profile.phone ?? "",
            scholarUrl: profile.scholarUrl ?? "",
            orcid: profile.orcid ?? "",
            researchGateUrl: profile.researchGateUrl ?? "",
            linkedinUrl: profile.linkedinUrl ?? "",
            supervisionText: profile.supervisionText ?? "",
          }}
          existingMedia={existingMedia}
          allResearchAreas={allResearchAreas}
          photoAsset={profile.photo}
          saveAction={adminUpdateLecturerSelfFieldsAction}
          hiddenFields={{ profileId: profile.id }}
        />
      </section>

      {profile.publications.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Publications (managed by the lecturer)</h2>
          <ul className="space-y-1 text-sm">
            {profile.publications.map((p) => (
              <li key={p.id}>{p.title} ({p.year})</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
