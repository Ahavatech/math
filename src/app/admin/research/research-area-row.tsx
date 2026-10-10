"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { MediaAsset, ResearchArea } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";
import { reorderResearchAreaAction } from "@/server/actions/research-areas";

export function ResearchAreaRow({
  area,
  needsReview,
}: {
  area: ResearchArea & { image: MediaAsset | null };
  needsReview: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", area.id);
      fd.set("direction", direction);
      await reorderResearchAreaAction(fd);
      window.location.reload();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <Link href={`/admin/research/${area.id}`} className="font-medium hover:underline">
          {area.title}
        </Link>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{area.status}</Badge>
          {needsReview ? <Badge variant="outline">Imported from the old site, needs HOD review</Badge> : null}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={() => move("up")} disabled={pending}>
          <ArrowUp className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => move("down")} disabled={pending}>
          <ArrowDown className="size-4" />
        </Button>
      </div>
    </li>
  );
}
