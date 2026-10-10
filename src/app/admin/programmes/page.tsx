import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listProgrammesAdmin } from "@/server/services/programmes";
import { getSetting } from "@/server/services/site-settings";
import { enumToLevelSlug } from "@/lib/programme-level";
import { Badge } from "@/components/ui/badge";

export default async function AdminProgrammesPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const [programmes, importFlags] = await Promise.all([
    listProgrammesAdmin(db),
    getSetting(db, "programmes.importFlags"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Programmes</h1>
      <ul className="divide-y divide-border rounded-md border border-border">
        {programmes.map((programme) => (
          <li key={programme.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <Link href={`/admin/programmes/${enumToLevelSlug(programme.level)}`} className="font-medium hover:underline">
                {programme.title}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{programme.status}</Badge>
                {importFlags[programme.slug] ? (
                  <Badge variant="outline">Imported from the old site, needs HOD review</Badge>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
