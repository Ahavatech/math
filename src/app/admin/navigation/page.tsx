import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listNavItems } from "@/server/services/navigation";
import { NavSection } from "./nav-section";

export default async function AdminNavigationPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const [header, footer] = await Promise.all([
    listNavItems(db, "HEADER"),
    listNavItems(db, "FOOTER"),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold">Navigation</h1>
      <NavSection title="Header" location="HEADER" items={header} />
      <NavSection title="Footer" location="FOOTER" items={footer} />
    </div>
  );
}
