import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listUsers } from "@/server/services/users";
import { UsersTable } from "./users-table";
import { InviteUserDialog } from "./invite-user-dialog";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasRole(user, "SUPER_ADMIN")) {
    redirect("/403");
  }

  const users = await listUsers(db);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users</h1>
        <InviteUserDialog />
      </div>
      <UsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
