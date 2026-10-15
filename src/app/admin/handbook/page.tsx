import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listHandbookTreeAdmin } from "@/server/services/handbook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReorderButtons } from "./reorder-buttons";

export default async function AdminHandbookPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const pages = await listHandbookTreeAdmin(db);
  const topLevel = pages.filter((p) => !p.parentId);
  const childrenOf = (parentId: string) => pages.filter((p) => p.parentId === parentId);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Handbook</h1>
        <Button render={<Link href="/admin/handbook/new">New page</Link>} />
      </div>

      <ul className="space-y-3">
        {topLevel.map((page) => (
          <li key={page.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-4">
              <Link href={`/admin/handbook/${page.id}`} className="font-medium hover:underline">
                {page.title}
              </Link>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{page.status}</Badge>
                <ReorderButtons id={page.id} />
              </div>
            </div>
            {childrenOf(page.id).length > 0 ? (
              <ul className="mt-2 ml-4 space-y-1 border-l border-border pl-3">
                {childrenOf(page.id).map((child) => (
                  <li key={child.id} className="flex items-center justify-between gap-4">
                    <Link href={`/admin/handbook/${child.id}`} className="text-sm hover:underline">
                      {child.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{child.status}</Badge>
                      <ReorderButtons id={child.id} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {pages.length === 0 ? <p className="text-sm text-muted-foreground">No handbook pages yet.</p> : null}
      </ul>
    </div>
  );
}
