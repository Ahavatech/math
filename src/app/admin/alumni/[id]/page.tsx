import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission, hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getAlumniEntryAdmin, findPossibleDuplicates } from "@/server/services/alumni-entries";
import { ReviewForm } from "./review-form";

export default async function AlumniReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "alumni.review")) {
    redirect("/403");
  }

  const { id } = await params;
  let entry;
  try {
    entry = await getAlumniEntryAdmin(db, id);
  } catch {
    notFound();
  }

  const rawDuplicates = await findPossibleDuplicates(db, entry.dedupeKey, entry.id);
  // Fetch programmes for each duplicate so the ReviewForm can display them
  const duplicates = await Promise.all(
    rawDuplicates.map(async (d) => {
      const programmes = await db.alumniProgramme.findMany({
        where: { alumnusId: d.id },
        orderBy: { graduationYear: "asc" },
      });
      return { ...d, programmes };
    }),
  );
  const canErase = hasRole(user, ["HOD", "SUPER_ADMIN"]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Review alumni entry</h1>
      <ReviewForm entry={entry} duplicates={duplicates} canErase={canErase} />
    </div>
  );
}
