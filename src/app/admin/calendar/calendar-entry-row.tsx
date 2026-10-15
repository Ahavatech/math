"use client";

import { useState, useTransition } from "react";
import type { AcademicCalendarEntry } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { deleteCalendarEntryAction } from "@/server/actions/academic-calendar";
import { CalendarEntryForm } from "./calendar-entry-form";

export function CalendarEntryRow({ entry }: { entry: AcademicCalendarEntry }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", entry.id);
      await deleteCalendarEntryAction(fd);
      window.location.reload();
    });
  }

  if (editing) {
    return <CalendarEntryForm entry={entry} onSaved={() => setEditing(false)} />;
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <p className="font-medium">{entry.title}</p>
        <p className="text-xs text-muted-foreground">
          {entry.session} - {entry.startDate.toISOString().slice(0, 10)}
          {entry.endDate ? ` to ${entry.endDate.toISOString().slice(0, 10)}` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={remove}>Delete</Button>
      </div>
    </li>
  );
}
