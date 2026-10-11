"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { MediaAsset, NonTeachingStaff } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";
import { reorderNonTeachingStaffAction, setNonTeachingStaffActiveAction } from "@/server/actions/non-teaching-staff";

export function StaffRow({
  staff,
  needsReview,
}: {
  staff: NonTeachingStaff & { photo: MediaAsset | null };
  needsReview: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", staff.id);
      fd.set("direction", direction);
      await reorderNonTeachingStaffAction(fd);
      window.location.reload();
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", staff.id);
      fd.set("isActive", String(!staff.isActive));
      await setNonTeachingStaffActiveAction(fd);
      window.location.reload();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <Link href={`/admin/staff/${staff.id}`} className="font-medium hover:underline">
          {staff.name}
        </Link>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{staff.position}</span>
          <Badge variant="secondary">{staff.isActive ? "Active" : "Archived"}</Badge>
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
        <Button type="button" variant="outline" size="sm" onClick={toggleActive} disabled={pending}>
          {staff.isActive ? "Archive" : "Restore"}
        </Button>
      </div>
    </li>
  );
}
