"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { Event } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatWAT } from "@/lib/time";
import { setEventStatusAction } from "@/server/actions/events";
import { StatusBadge } from "@/components/admin/status-badge";
import { humanise } from "@/lib/labels";

export function EventRow({ event, needsReview }: { event: Event; needsReview: boolean }) {
  const [pending, startTransition] = useTransition();

  function setStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", event.id);
      fd.set("status", status);
      await setEventStatusAction(fd);
      window.location.reload();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <Link href={`/admin/events/${event.id}`} className="font-medium hover:underline">
          {event.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{humanise(event.type)}</Badge>
          <StatusBadge status={event.status} />
          <span>{formatWAT(event.startsAt)}</span>
          {event.venue ? <span>- {event.venue}</span> : null}
          {needsReview ? <Badge variant="outline">Imported from the old site, needs HOD review</Badge> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {event.status === "ARCHIVED" ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("DRAFT")} aria-label={`Restore: ${event.title}`}>
            Restore
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("ARCHIVED")} aria-label={`Archive: ${event.title}`}>
            Archive
          </Button>
        )}
        {event.status === "PUBLISHED" ? (
          <a href={`/events/${event.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline" aria-label={`View public page: ${event.title}`}>
            View public
          </a>
        ) : null}
      </div>
    </li>
  );
}
