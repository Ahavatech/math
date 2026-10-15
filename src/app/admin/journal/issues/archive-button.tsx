"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ArchiveButton({ id, action }: { id: string; action: (id: string) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => action(id))}
    >
      Archive
    </Button>
  );
}
