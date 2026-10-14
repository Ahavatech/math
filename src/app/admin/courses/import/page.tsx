import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { CourseImportWizard } from "./import-wizard";

export default async function CourseImportPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Import courses</h1>
      <p className="text-sm text-muted-foreground">
        CSV columns: code, title, units, level, semester, programme, elective, prerequisites (codes
        separated by semicolons), description. Up to 500 rows.
      </p>
      <CourseImportWizard />
    </div>
  );
}
