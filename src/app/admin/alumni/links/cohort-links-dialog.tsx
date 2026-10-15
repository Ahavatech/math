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
import { createCohortLinksAction } from "@/server/actions/alumni-links";

function downloadCsv(links: { label: string; year: number; url: string }[]) {
  const rows = ["label,year,url", ...links.map((l) => `"${l.label}",${l.year},"${l.url}"`)];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = "alumni-cohort-links.csv";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export function CohortLinksDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createCohortLinksAction, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline">Generate links for years</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate one link per graduation year</DialogTitle>
        </DialogHeader>

        {state?.success && state.links ? (
          <div className="space-y-3">
            <p className="text-sm">
              Created {state.links.length} links. This file contains live links to the submission form -
              treat it like a password and do not post it anywhere public.
            </p>
            <Button type="button" onClick={() => downloadCsv(state.links!)}>
              Download CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="years">Years (range or list)</Label>
              <Input id="years" name="years" required placeholder="e.g. 2000-2005 or 2001,2003,2007" />
            </div>
            <p className="text-xs text-muted-foreground">Up to 60 links per action.</p>
            {state?.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create links"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
