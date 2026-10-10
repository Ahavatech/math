import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listResearchAreasAdmin } from "@/server/services/research-areas";
import { getSetting } from "@/server/services/site-settings";
import { Button } from "@/components/ui/button";
import { ResearchAreaRow } from "./research-area-row";

export default async function AdminResearchPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
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
        {areas.length === 0 ? <p className="text-sm text-muted-foreground">No research areas yet.</p> : null}
      </ul>
    </div>
  );
}
