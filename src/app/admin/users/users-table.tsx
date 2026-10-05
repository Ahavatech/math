"use client";

import type { User, UserRole } from "@prisma/client";
import { resendInviteAction, setUserActiveAction } from "@/server/actions/admin-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { EditRolesDialog } from "./edit-roles-dialog";

type UserWithRoles = User & { roles: UserRole[] };

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserWithRoles[];
  currentUserId: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;

          return (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((r) => (
                    <Badge key={r.id} variant="secondary">
                      {r.role}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={user.isActive ? "default" : "destructive"}>
                  {user.isActive ? "Active" : "Deactivated"}
                </Badge>
                {!user.passwordHash ? (
                  <Badge variant="outline" className="ml-1">
                    Invite pending
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <EditRolesDialog user={user} />
                {!user.passwordHash ? (
                  <form action={resendInviteAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Resend invite
                    </Button>
                  </form>
                ) : null}
                <form action={setUserActiveAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={user.isActive ? "false" : "true"}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={isSelf && user.isActive}
                    title={
                      isSelf && user.isActive
                        ? "You cannot deactivate yourself"
                        : undefined
                    }
                  >
                    {user.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
