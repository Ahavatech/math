import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listUsersPage } from "@/server/services/users";
import { PageNav } from "@/components/ui/filter-links";
import { Button } from "@/components/ui/button";
import { UsersTable } from "./users-table";
import { InviteUserDialog } from "./invite-user-dialog";

const PER_PAGE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasRole(user, "SUPER_ADMIN")) {
    redirect("/403");
  }

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const { users, total, page, totalPages } = await listUsersPage(db, {
    q,
    page: Number(params.page) || 1,
    perPage: PER_PAGE,
  });

  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const last = Math.min(total, page * PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users</h1>
        <InviteUserDialog />
      </div>

      <form method="get" role="search" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search users by name or email"
          placeholder="Search by name or email"
          className="h-10 w-full max-w-sm border border-input bg-background px-3 text-base"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q ? (
          <Link href="/admin/users" className="link-rule py-2 font-medium">
            Clear
          </Link>
        ) : null}
      </form>

      <p className="tabular text-muted-foreground" role="status">
        {total === 0
          ? q
            ? `No users match "${q}".`
            : "There are no users yet."
          : `Showing ${first} to ${last} of ${total} ${total === 1 ? "user" : "users"}${q ? ` matching "${q}"` : ""}.`}
      </p>

      <UsersTable users={users} currentUserId={user.id} />

      {totalPages > 1 ? (
        <PageNav
          page={page}
          totalPages={totalPages}
          hrefFor={(target) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(target) }).toString()}`}
        />
      ) : null}
    </div>
  );
}
