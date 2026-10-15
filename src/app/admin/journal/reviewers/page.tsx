import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission, hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";

export function generateMetadata() {
  return { title: "Reviewers" };
}

export default async function AdminJournalReviewersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasPermission(user, "journal.editorial") || hasRole(user, "HOD")) {
    redirect("/admin");
  }

  const reviewers = await db.userRole.findMany({
    where: { role: "REVIEWER" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          _count: { select: { reviewAssignments: true } },
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Reviewers</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Users with the REVIEWER role. Assignments are managed per manuscript.
      </p>
      {reviewers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No reviewers found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Verified</th>
              <th className="py-2">Assignments</th>
            </tr>
          </thead>
          <tbody>
            {reviewers.map(({ user: u }) => (
              <tr key={u.id} className="border-b">
                <td className="py-2 pr-4">{u.name ?? "-"}</td>
                <td className="py-2 pr-4">{u.email}</td>
                <td className="py-2 pr-4">
                  {u.emailVerifiedAt ? (
                    <span className="text-green-600 text-xs">Yes</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">No</span>
                  )}
                </td>
                <td className="py-2">{u._count.reviewAssignments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
