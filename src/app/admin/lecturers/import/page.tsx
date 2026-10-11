import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { ImportWizard } from "./import-wizard";

export default async function LecturerImportPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "lecturers.manage")) {
    redirect("/403");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Bulk import lecturers</h1>
      <p className="text-sm text-muted-foreground">
        Upload a CSV with columns <code>fullName,honorific,rank,email</code> (max 200 rows). A
        template with the department&apos;s own staff is at{" "}
        <code>docs/lecturer-import-template.csv</code>.
      </p>
      <ImportWizard />
    </div>
  );
}
