"use client";

import { useEffect, useState } from "react";
import { getPublishingChecklistAction } from "@/server/actions/journal-articles";

export function PublishingChecklist({ articleId }: { articleId: string }) {
  const [items, setItems] = useState<{ label: string; met: boolean }[] | null>(null);

  useEffect(() => {
    getPublishingChecklistAction(articleId).then(setItems);
  }, [articleId]);

  if (!items) return null;

  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p className="font-medium">Publishing checklist</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => (
          <li key={item.label} className={item.met ? "text-foreground" : "text-muted-foreground"}>
            {item.met ? "✓" : "○"} {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
