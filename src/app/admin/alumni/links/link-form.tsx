"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAlumniLinkAction } from "@/server/actions/alumni-links";

export function LinkCreateForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createAlumniLinkAction, undefined);
  const [copied, setCopied] = useState(false);

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(() => setCopied(true));
  }

  const message = (url: string) =>
    `The Department of Mathematics, OAU, would like to add you to its alumni directory. Please take two minutes to fill in where you are now: ${url}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCopied(false);
      }}
    >
      <DialogTrigger render={<Button type="button">Create link</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an alumni link</DialogTitle>
        </DialogHeader>

        {state?.success && state.url ? (
          <div className="space-y-3">
            <p className="text-sm">
              This link is shown once. Copy it now and send it to the alumnus; it will not be shown again.
            </p>
            <Input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" size="sm" onClick={() => copy(state.url!)}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Label>Ready-to-send message</Label>
            <textarea readOnly value={message(state.url)} className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm" />
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" required placeholder="e.g. 2010 cohort" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cohortYear">Cohort year (optional)</Label>
              <Input id="cohortYear" name="cohortYear" type="number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiresInDays">Expires in days (default 90)</Label>
              <Input id="expiresInDays" name="expiresInDays" type="number" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxUses">Maximum uses (optional)</Label>
              <Input id="maxUses" name="maxUses" type="number" />
            </div>
            {state?.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
