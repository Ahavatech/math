"use client";

import { useState, useTransition } from "react";
import type { EventSeries } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createEventSeriesAction, updateEventSeriesAction } from "@/server/actions/events";

export function SeriesForm({ series }: { series: EventSeries | null }) {
  const [title, setTitle] = useState(series?.title ?? "");
  const [description, setDescription] = useState(series?.description ?? "");
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      if (series) fd.set("id", series.id);
      fd.set("title", title);
      fd.set("description", description);
      const action = series ? updateEventSeriesAction : createEventSeriesAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error && !series) {
        setTitle("");
        setDescription("");
      }
      if (!res.error) window.location.reload();
    });
  }

  return (
    <div className="mt-2 space-y-2">
      {!series ? <h2 className="font-heading text-base font-semibold">New series</h2> : null}
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label className="sr-only">Description</Label>
      <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      <Button type="button" size="sm" onClick={save} disabled={pending || !title.trim()}>
        {pending ? "Saving..." : series ? "Save" : "Create series"}
      </Button>
    </div>
  );
}
