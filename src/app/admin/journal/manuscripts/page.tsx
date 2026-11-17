import { redirect } from "next/navigation";
import { AdminEmpty } from "@/components/admin/admin-bits";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { listManuscripts } from "@/server/services/manuscript-screening";

export const metadata = { title: "Manuscripts" };

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  SCREENING: "Screening",
  RETURNED_TO_AUTHOR: "Returned",
  UNDER_REVIEW: "Under review",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

// Same grammar as StatusBadge: red needs a person, dashed is in progress, solid
// ink is moving, outlined red is turned away, grey is set aside. Token colours,
// so they flip with dark mode.
const STATUS_CLASSES: Record<string, string> = {
  SUBMITTED: "border-accent bg-accent text-accent-foreground",
  SCREENING: "border-dashed border-foreground/60 bg-background text-foreground",
  RETURNED_TO_AUTHOR: "border-destructive bg-background text-destructive",
  UNDER_REVIEW: "border-primary bg-primary text-primary-foreground",
  REJECTED: "border-destructive bg-background text-destructive",
  WITHDRAWN: "border-border bg-muted text-muted-foreground",
};

export default async function ManuscriptsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canRead =
    hasPermission(user, "journal.editorial") ||
    hasPermission(user, "journal.manuscripts.read");
  if (!canRead) redirect("/admin");

  const { status, search } = await searchParams;
  const sessionUser = { id: user.id, roles: user.roles, isActive: user.isActive ?? true };

  const manuscripts = await listManuscripts(prisma, sessionUser, {
    status: status || undefined,
    search: search || undefined,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manuscripts</h1>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-4 flex flex-wrap gap-3">
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status ?? ""}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input
          name="search"
          defaultValue={search ?? ""}
          placeholder="Search by title..."
          aria-label="Search by title"
          className="w-full rounded-md border px-3 py-1.5 text-sm sm:w-64"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Filter
        </button>
        <Link href="/admin/journal/manuscripts" className="rounded-md border px-3 py-1.5 text-sm">
          Clear
        </Link>
      </form>

      {manuscripts.length === 0 ? (
        <AdminEmpty title="No manuscripts match">Try a different status or search. New submissions appear here as soon as an author submits.</AdminEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium">Reference</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Submitted</th>
                <th className="pb-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {manuscripts.map((ms) => (
                <tr key={ms.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                    {ms.reference ?? "-"}
                  </td>
                  <td className="py-2 pr-4 max-w-xs truncate">{ms.title}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex h-6 items-center border px-2 text-[0.8125rem] font-medium whitespace-nowrap ${STATUS_CLASSES[ms.status] ?? "border-border"}`}
                    >
                      {STATUS_LABELS[ms.status] ?? ms.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {ms.submittedAt ? new Date(ms.submittedAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/admin/journal/manuscripts/${ms.id}`}
                      className="text-primary underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
