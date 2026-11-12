import { redirect } from "next/navigation";
import { AdminEmpty } from "@/components/admin/admin-bits";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listResearchAreasAdmin } from "@/server/services/research-areas";
import { getSetting } from "@/server/services/site-settings";
import { Button } from "@/components/ui/button";
import { ResearchAreaRow } from "./research-area-row";

export default async function AdminResearchPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "academics.manage")) {
    redirect("/403");
  }

  const [areas, importFlags] = await Promise.all([
    listResearchAreasAdmin(db),
    getSetting(db, "research.importFlags"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Research areas</h1>
        <Button render={<Link href="/admin/research/new">New research area</Link>} />
      </div>
      <ul className="space-y-2">
        {areas.map((area) => (
          <ResearchAreaRow key={area.id} area={area} needsReview={Boolean(importFlags[area.slug])} />
        ))}
        {areas.length === 0 ? <AdminEmpty title="No research areas yet">Research areas show on the public research page. Add one with a short description and an image.</AdminEmpty> : null}
      </ul>
    </div>
  );
}
