import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listAlumniLinksAdmin } from "@/server/services/alumni-links";
import { LinkCreateForm } from "./link-form";
import { CohortLinksDialog } from "./cohort-links-dialog";
import { LinkRow } from "./link-row";

export default async function AdminAlumniLinksPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "alumni.review")) {
    redirect("/403");
  }

  const links = await listAlumniLinksAdmin(db);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Alumni links</h1>
        <Link href="/admin/alumni" className="text-sm text-primary underline">
          Back to review queue
        </Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <LinkCreateForm />
        <CohortLinksDialog />
      </div>

      <ul className="space-y-2">
        {links.map((link) => {
          const status = !link.isActive
            ? "inactive"
            : link.expiresAt < new Date()
              ? "expired"
              : link.maxUses !== null && link.useCount >= link.maxUses
                ? "exhausted"
                : "active";
          return <LinkRow key={link.id} link={link} status={status} entriesReceived={link._count.entries} />;
        })}
        {links.length === 0 ? <p className="text-sm text-muted-foreground">No links yet.</p> : null}
      </ul>
    </div>
  );
}
