"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type RevisionSummary = {
  id: string;
  createdAt: string;
  createdByName: string;
};

/**
 * Generic ContentRevision history + restore dialog for any admin content
 * type (Programme, ResearchArea, and whatever later stages add) backed
 * by src/server/services/revisions.ts. See docs/PATTERNS.md.
 *
 * Unlike Stage 05's settings-specific version-history-dialog.tsx, this
 * one takes plain async callbacks instead of a SettingsKey, so it isn't
 * tied to the site-settings registry.
 */
export function VersionHistoryDialog({
  listRevisions,
  onRestore,
}: {
  listRevisions: () => Promise<RevisionSummary[]>;
  onRestore: (revisionId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      startTransition(async () => {
        setRevisions(await listRevisions());
      });
    }
  }

  function restore(revisionId: string) {
    startTransition(async () => {
      await onRestore(revisionId);
      setOpen(false);
      /**
       * Restoring changes fields this form seeded from props with
       * useState; a soft refresh won't re-trigger that, so a full
       * reload guarantees the form shows what was actually restored
       * (see Stage 05, same issue in the site settings editor).
       */
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="ghost">Version history</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
        </DialogHeader>
        {pending && !revisions ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {(revisions ?? []).map((rev, i) => (
              <li
                key={rev.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
              >
                <span>
                  {new Date(rev.createdAt).toLocaleString()} - {rev.createdByName}
                  {i === 0 ? " (current)" : ""}
                </span>
                {i !== 0 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => restore(rev.id)}>
                    Restore
                  </Button>
                ) : null}
              </li>
            ))}
            {revisions?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved versions yet.</p>
            ) : null}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
