"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setContactNotificationEmailAction } from "@/server/actions/contact";

export function NotificationSettingsForm({ currentValue }: { currentValue: string }) {
  const [state, action, pending] = useActionState(setContactNotificationEmailAction, undefined);

  return (
    <form action={action} className="flex items-end gap-2 rounded-md border border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="notificationEmail">Notify this address of new messages (optional)</Label>
        <Input id="notificationEmail" name="notificationEmail" type="email" defaultValue={currentValue} placeholder="e.g. hod@maths.oauife.edu.ng" className="w-72" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
      {state?.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
    </form>
  );
}
