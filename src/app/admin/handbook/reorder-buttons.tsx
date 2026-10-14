"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reorderHandbookPageAction } from "@/server/actions/handbook";

export function ReorderButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("direction", direction);
      await reorderHandbookPageAction(fd);
      window.location.reload();
    });
  }

  return (
    <div className="flex gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => move("up")}>
        Up
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => move("down")}>
        Down
      </Button>
    </div>
  );
}
