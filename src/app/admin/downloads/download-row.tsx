"use client";

import { useTransition } from "react";
import type { Download } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setDownloadStatusAction, reorderDownloadAction } from "@/server/actions/downloads";

export function DownloadRow({ download }: { download: Download }) {
  const [pending, startTransition] = useTransition();

  function setStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", download.id);
      fd.set("status", status);
      await setDownloadStatusAction(fd);
      window.location.reload();
    });
  }

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", download.id);
      fd.set("direction", direction);
      await reorderDownloadAction(fd);
      window.location.reload();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <a href={download.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
          {download.title}
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{download.status}</Badge>
          {download.fileSize ? <span>{Math.round(download.fileSize / 1024)} KB</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => move("up")}>Up</Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => move("down")}>Down</Button>
        {download.status === "ARCHIVED" ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("DRAFT")}>Restore</Button>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("ARCHIVED")}>Archive</Button>
        )}
        {download.status === "DRAFT" ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => setStatus("PUBLISHED")}>Publish</Button>
        ) : null}
      </div>
    </li>
  );
}
