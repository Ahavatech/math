import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getSetting } from "@/server/services/site-settings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPagesListPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const [pages, importFlags] = await Promise.all([
    db.page.findMany({ orderBy: { title: "asc" } }),
    getSetting(db, "pages.importFlags"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Pages</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <Link key={page.id} href={`/admin/pages/${page.id}`}>
            <Card className="h-full py-4 hover:border-primary/40">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{page.title}</span>
                  <Badge variant={page.status === "PUBLISHED" ? "default" : "outline"}>
                    {page.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <p className="text-xs text-muted-foreground">/{page.slug}</p>
                {importFlags[page.slug] ? (
                  <Badge variant="secondary" className="mt-2">
                    Imported from the old site, needs HOD review
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
