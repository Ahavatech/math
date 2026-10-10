"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SettingsKey } from "@/server/services/site-settings";
import { listSettingRevisionsAction, restoreSettingAction } from "@/server/actions/site-settings";

type Revision = {
  id: string;
  createdAt: string;
  createdByName: string;
  snapshot: unknown;
};

export function VersionHistoryDialog({ settingsKey }: { settingsKey: SettingsKey }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      startTransition(async () => {
        setRevisions(await listSettingRevisionsAction(settingsKey));
      });
    }
  }

  function restore(revisionId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("key", settingsKey);
      formData.set("revisionId", revisionId);
      await restoreSettingAction(formData);
      setOpen(false);
      router.refresh();
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
