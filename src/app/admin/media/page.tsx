import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listMediaAssets, countMediaUsage } from "@/server/services/media";
import { MediaGrid } from "./media-grid";

export default async function AdminMediaPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const assets = await listMediaAssets(db);
  const usageCounts = await Promise.all(assets.map((a) => countMediaUsage(db, a.id)));
  const assetsWithUsage = assets.map((asset, i) => ({ ...asset, usageCount: usageCounts[i] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Media</h1>
      </div>
      <MediaGrid assets={assetsWithUsage} />
    </div>
  );
}
