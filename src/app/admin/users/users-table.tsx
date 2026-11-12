"use client";

import { humanise } from "@/lib/labels";
import { resendInviteAction, setUserActiveAction, resetUserTwoFactorAction } from "@/server/actions/admin-users";
import type { SafeUser } from "@/server/services/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/confirm-button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { EditRolesDialog } from "./edit-roles-dialog";

export function UsersTable({
  users,
  currentUserId,
}: {
  users: SafeUser[];
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
                      {humanise(r.role)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={user.isActive ? "default" : "destructive"}>
                  {user.isActive ? "Active" : "Deactivated"}
                </Badge>
                {!user.hasPassword ? (
                  <Badge variant="outline" className="ml-1">
                    Invite pending
                  </Badge>
                ) : null}
                {user.hasTwoFactor ? (
                  <Badge variant="outline" className="ml-1">
                    Two-factor on
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <EditRolesDialog user={user} />
                {!user.hasPassword ? (
                  <form action={resendInviteAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Resend invite
                    </Button>
                  </form>
                ) : null}
                {user.hasTwoFactor && !isSelf ? (
                  <form action={resetUserTwoFactorAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      aria-label={`Reset two-factor sign-in for ${user.name}`}
                      title="Use when this person has lost their phone and their recovery codes. They set it up again at their next sign-in."
                    >
                      Reset two-factor
                    </Button>
                  </form>
                ) : null}
                {user.isActive ? (
                  <ConfirmButton
                    label="Deactivate"
                    subject={user.name}
                    variant="outline"
                    disabled={isSelf}
                    disabledTitle="You cannot deactivate yourself"
                    title={`Deactivate ${user.name}?`}
                    description="They are signed out within a minute and cannot sign in until you reactivate them. Their content and history are kept."
                    confirmLabel="Deactivate"
                    onConfirm={async () => {
                      const fd = new FormData();
                      fd.set("userId", user.id);
                      fd.set("isActive", "false");
                      await setUserActiveAction(fd);
                    }}
                  />
                ) : (
                  <form action={setUserActiveAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="isActive" value="true" />
                    <Button type="submit" size="sm" variant="outline" aria-label={`Reactivate: ${user.name}`}>
                      Reactivate
                    </Button>
                  </form>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
