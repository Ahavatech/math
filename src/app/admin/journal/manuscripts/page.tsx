import { redirect } from "next/navigation";
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

const STATUS_CLASSES: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  SCREENING: "bg-yellow-100 text-yellow-800",
  RETURNED_TO_AUTHOR: "bg-orange-100 text-orange-800",
  UNDER_REVIEW: "bg-purple-100 text-purple-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-muted text-muted-foreground",
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
      <form method="GET" className="mb-4 flex gap-3">
        <select
          name="status"
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
          className="rounded-md border px-3 py-1.5 text-sm w-64"
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
        <p className="text-muted-foreground text-sm">No manuscripts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium">Reference</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Submitted</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {manuscripts.map((ms) => (
                <tr key={ms.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                    {ms.reference ?? "—"}
                  </td>
                  <td className="py-2 pr-4 max-w-xs truncate">{ms.title}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[ms.status] ?? ""}`}
                    >
                      {STATUS_LABELS[ms.status] ?? ms.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {ms.submittedAt ? new Date(ms.submittedAt).toLocaleDateString() : "—"}
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
