import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { listJournalPagesAdmin, isJournalPagePlaceholder } from "@/server/services/journal-pages";

const LABELS: Record<string, string> = {
  "journal-about": "About (aims and scope)",
  "journal-guidelines": "Author guidelines",
  "journal-call-for-papers": "Call for papers",
  "journal-policies": "Policies (peer review, ethics, open access, copyright)",
};

export default async function JournalPagesPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.manage")) {
    redirect("/403");
  }

  const pages = await listJournalPagesAdmin();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-heading text-lg font-semibold">Journal pages</h1>
      <ul className="divide-y divide-border rounded-md border border-border">
        {pages.map((page) => (
          <li key={page.id} className="flex items-center justify-between p-3 text-sm">
            <div>
              <Link href={`/admin/journal/pages/${page.id}`} className="font-medium text-primary underline">
                {LABELS[page.slug] ?? page.title}
              </Link>
              <p className="text-muted-foreground">
                {page.status}
                {isJournalPagePlaceholder(page.body) ? " - needs editor input" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
