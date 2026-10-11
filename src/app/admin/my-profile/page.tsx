import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getLecturerByUserId, computeCompleteness } from "@/server/services/lecturers";
import {
  updateOwnLecturerProfileAction,
  listOwnLecturerRevisionsAction,
  restoreOwnLecturerProfileAction,
  requestPublishingAction,
} from "@/server/actions/lecturers";
import { LecturerSelfFieldsForm } from "@/components/admin/lecturer-self-fields-form";
import { PublicationsManager } from "@/components/admin/publications-manager";
import { CvUpload } from "@/components/admin/cv-upload";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft - not yet visible to the public",
  PUBLISHED: "Published - visible at your public page",
  ARCHIVED: "Archived - not visible to the public",
};

export default async function MyProfilePage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect("/login");
  }

  const profile = await getLecturerByUserId(db, user.id);
  if (!profile) {
    redirect("/403");
  }

  const [existingMedia, allResearchAreas] = await Promise.all([
    db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    db.researchArea.findMany({ where: { status: "PUBLISHED" }, orderBy: { order: "asc" } }),
  ]);

  const completeness = computeCompleteness({
    photoId: profile.photoId,
    bio: profile.bio,
    researchAreaCount: profile.researchAreas.length,
  });
  const checklist = [
    { label: "Photo with alt text", done: profile.photoId !== null },
    { label: "Bio", done: Boolean(profile.bio && profile.bio.trim()) },
    { label: "At least one research area", done: profile.researchAreas.length > 0 },
  ];

  async function restoreRevision(revisionId: string) {
    const fd = new FormData();
    fd.set("revisionId", revisionId);
    await restoreOwnLecturerProfileAction(fd);
  }

  async function requestPublishing() {
    await requestPublishingAction();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">My profile</h1>
        <Link href="/admin/my-profile/security" className="text-sm underline">
          Change password
        </Link>
      </div>

      <section className="space-y-2 rounded-md border border-border p-4">
        <h2 className="font-heading text-base font-semibold">Publishing status</h2>
        <p className="text-sm">{STATUS_LABEL[profile.status] ?? profile.status}</p>
        {profile.status !== "ARCHIVED" ? (
          <>
            <ul className="space-y-1 text-sm">
              {checklist.map((item) => (
                <li key={item.label} className={item.done ? "text-foreground" : "text-muted-foreground"}>
                  {item.done ? "Done" : "Missing"} - {item.label}
                </li>
              ))}
            </ul>
            {profile.status === "DRAFT" ? (
              profile.publishRequestedAt ? (
                <p className="text-sm text-muted-foreground">
                  You requested publishing on {profile.publishRequestedAt.toLocaleDateString()}. An admin will review it.
                </p>
              ) : (
                <form action={requestPublishing}>
                  <Button type="submit" disabled={completeness < 100}>
                    Request publishing
                  </Button>
                </form>
              )
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Profile</h2>
          <VersionHistoryDialog listRevisions={listOwnLecturerRevisionsAction} onRestore={restoreRevision} />
        </div>
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
          saveAction={updateOwnLecturerProfileAction}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-base font-semibold">CV</h2>
        <CvUpload cvDownload={profile.cvDownload} />
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-base font-semibold">Publications</h2>
        <PublicationsManager publications={profile.publications} />
      </section>
    </div>
  );
}
