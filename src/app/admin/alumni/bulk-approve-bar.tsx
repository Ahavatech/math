"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { bulkApproveAlumniEntriesAction } from "@/server/actions/alumni-review";

/** Approves every entry that has no duplicate flag; flagged entries are left for individual review (see bulkApprove in the service layer). */
export function BulkApproveBar({ unflaggedIds }: { unflaggedIds: string[] }) {
  const [pending, startTransition] = useTransition();

  if (unflaggedIds.length === 0) return null;

  function approveAll() {
    startTransition(async () => {
      const fd = new FormData();
      for (const id of unflaggedIds) fd.append("ids", id);
      await bulkApproveAlumniEntriesAction(fd);
      window.location.reload();
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted p-3 text-sm">
      <span>{unflaggedIds.length} entries have no duplicate flag and can be approved together.</span>
      <Button type="button" size="sm" disabled={pending} onClick={approveAll}>
        {pending ? "Approving..." : "Bulk approve"}
      </Button>
    </div>
  );
}
