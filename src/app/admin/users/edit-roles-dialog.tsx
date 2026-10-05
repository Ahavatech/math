"use client";

import { useActionState } from "react";
import type { User, UserRole } from "@prisma/client";
import { editUserRolesAction } from "@/server/actions/admin-users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { RoleCheckboxes } from "./role-checkboxes";

export function EditRolesDialog({ user }: { user: User & { roles: UserRole[] } }) {
  const [state, formAction, pending] = useActionState(editUserRolesAction, undefined);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Edit roles
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit roles for {user.name}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <RoleCheckboxes defaultRoles={user.roles.map((r) => r.role)} />
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save roles"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
