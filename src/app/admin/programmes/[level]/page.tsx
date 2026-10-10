import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getSetting } from "@/server/services/site-settings";
import { levelSlugToEnum } from "@/lib/programme-level";
import { ProgrammeEditorForm } from "./programme-editor-form";
import { SpecialisationsManager } from "./specialisations-manager";

export default async function AdminProgrammePage({ params }: { params: Promise<{ level: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const { level: levelSlug } = await params;
  const level = levelSlugToEnum(levelSlug);
  if (!level) notFound();

  const [programme, importFlags] = await Promise.all([
    db.programme.findFirst({ where: { level }, include: { specialisations: { orderBy: { order: "asc" } } } }),
    getSetting(db, "programmes.importFlags"),
  ]);
  if (!programme) notFound();

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="font-heading text-lg font-semibold">{programme.title}</h1>
        {importFlags[programme.slug] ? (
          <p className="mt-1 text-xs text-muted-foreground">Imported from the old site, needs HOD review.</p>
        ) : null}
      </div>
      <ProgrammeEditorForm programme={programme} />
      <SpecialisationsManager programmeId={programme.id} specialisations={programme.specialisations} />
    </div>
  );
}
