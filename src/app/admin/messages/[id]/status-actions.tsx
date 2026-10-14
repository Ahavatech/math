"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setContactMessageStatusAction } from "@/server/actions/contact";

const STATUSES = ["NEW", "READ", "REPLIED", "ARCHIVED"] as const;

export function StatusActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: (typeof STATUSES)[number]) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("status", next);
      await setContactMessageStatusAction(fd);
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.filter((s) => s !== status).map((s) => (
        <Button key={s} type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus(s)}>
          Mark as {s.toLowerCase()}
        </Button>
      ))}
    </div>
  );
}
