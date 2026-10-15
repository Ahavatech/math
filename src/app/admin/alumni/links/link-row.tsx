"use client";

import { useTransition } from "react";
import type { AlumniLink } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { regenerateAlumniLinkAction, setAlumniLinkActiveAction } from "@/server/actions/alumni-links";

export function LinkRow({
  link,
  status,
  entriesReceived,
}: {
  link: AlumniLink;
  status: "active" | "expired" | "exhausted" | "inactive";
  entriesReceived: number;
}) {
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", link.id);
      fd.set("isActive", String(status === "inactive"));
      await setAlumniLinkActiveAction(fd);
      window.location.reload();
    });
  }

  function regenerate() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", link.id);
      const result = await regenerateAlumniLinkAction(fd);
      if (result.url) {
        window.alert(`New link (copy it now, it will not be shown again):\n\n${result.url}`);
      }
      window.location.reload();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <p className="font-medium">{link.label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{status}</Badge>
          {link.cohortYear ? <span>Cohort {link.cohortYear}</span> : null}
          <span>{link.useCount} use{link.useCount === 1 ? "" : "s"}{link.maxUses ? ` / ${link.maxUses} max` : ""}</span>
          <span>{entriesReceived} entries received</span>
          <span>Expires {link.expiresAt.toLocaleDateString()}</span>
          {link.lastUsedAt ? <span>Last used {link.lastUsedAt.toLocaleDateString()}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={regenerate}>
          Regenerate
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={toggleActive}>
          {status === "inactive" ? "Reactivate" : "Deactivate"}
        </Button>
      </div>
    </li>
  );
}
