"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { AlumniEntry } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { withdrawAlumniEntryAction, restoreAlumniEntryAction, setAlumniFeaturedAction } from "@/server/actions/alumni-review";

export function EntryRow({
  entry,
  isDuplicateFlagged,
  tab,
}: {
  entry: AlumniEntry & { link?: { label: string } | null };
  isDuplicateFlagged: boolean;
  tab: string;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<unknown>, extra?: Record<string, string>) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", entry.id);
      if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      await action(fd);
      window.location.reload();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <Link href={`/admin/alumni/${entry.id}`} className="font-medium hover:underline">
          {entry.fullName}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{entry.level}</Badge>
          <span>{entry.graduationYear}</span>
          {entry.organisation ? <span>{entry.organisation}</span> : null}
          {entry.link?.label ? <span>via {entry.link.label}</span> : null}
          {entry.isFeatured ? <Badge>Featured</Badge> : null}
          {isDuplicateFlagged ? <Badge variant="outline">Possible duplicate</Badge> : null}
          <span>{entry.createdAt.toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button render={<Link href={`/admin/alumni/${entry.id}`}>Review</Link>} size="sm" variant="outline" />
        {tab === "approved" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(setAlumniFeaturedAction, { isFeatured: entry.isFeatured ? "false" : "true" })}
            >
              {entry.isFeatured ? "Unfeature" : "Feature"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(withdrawAlumniEntryAction)}>
              Withdraw
            </Button>
          </>
        ) : null}
        {tab === "withdrawn" ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(restoreAlumniEntryAction)}>
            Restore
          </Button>
        ) : null}
      </div>
    </li>
  );
}
