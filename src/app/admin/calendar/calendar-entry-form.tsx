"use client";

import { useState, useTransition } from "react";
import type { AcademicCalendarEntry } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCalendarEntryAction, updateCalendarEntryAction } from "@/server/actions/academic-calendar";

function toDateInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function CalendarEntryForm({ entry, onSaved }: { entry: AcademicCalendarEntry | null; onSaved?: () => void }) {
  const [session, setSession] = useState(entry?.session ?? "");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [startDate, setStartDate] = useState(toDateInput(entry?.startDate ?? null));
  const [endDate, setEndDate] = useState(toDateInput(entry?.endDate ?? null));
  const [description, setDescription] = useState(entry?.description ?? "");
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      if (entry) fd.set("id", entry.id);
      fd.set("session", session);
      fd.set("title", title);
      fd.set("startDate", startDate);
      if (endDate) fd.set("endDate", endDate);
      fd.set("description", description);
      const action = entry ? updateCalendarEntryAction : createCalendarEntryAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error) {
        if (!entry) {
          setSession("");
          setTitle("");
          setStartDate("");
          setEndDate("");
          setDescription("");
        }
        onSaved?.();
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <h2 className="font-medium">{entry ? "Edit entry" : "New entry"}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="session">Session</Label>
          <Input id="session" value={session} onChange={(e) => setSession(e.target.value)} placeholder="e.g. 2026/2027" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End date (optional)</Label>
          <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {result?.error ? <p className="text-sm text-destructive" role="alert">{result.error}</p> : null}
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
