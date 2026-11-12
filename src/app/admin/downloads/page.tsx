import { redirect } from "next/navigation";
import { AdminEmpty } from "@/components/admin/admin-bits";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listDownloadsAdmin } from "@/server/services/downloads";
import { UploadForm } from "./upload-form";
import { DownloadRow } from "./download-row";

export default async function AdminDownloadsPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const downloads = await listDownloadsAdmin(db);
  const byCategory = new Map<string, typeof downloads>();
  for (const d of downloads) {
    byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Downloads</h1>
      <UploadForm />

      {[...byCategory.entries()].map(([category, items]) => (
        <div key={category} className="space-y-2">
          <h2 className="font-heading text-sm font-semibold uppercase text-muted-foreground">{category}</h2>
          <ul className="space-y-2">
            {items.map((d) => (
              <DownloadRow key={d.id} download={d} />
            ))}
          </ul>
        </div>
      ))}
      {downloads.length === 0 ? <AdminEmpty title="No downloads yet">Upload forms, timetables and guides for students. Each published file appears on the student resources page.</AdminEmpty> : null}
    </div>
  );
}
