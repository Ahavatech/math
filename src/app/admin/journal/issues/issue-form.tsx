"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MediaPicker, type SelectedMedia } from "@/components/admin/media-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createIssueAction, updateIssueAction } from "@/server/actions/journal-issues";

type IssueInput = {
  id?: string;
  volume: number;
  number: number;
  year: number;
  title: string | null;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  cover: { url: string; alt: string | null } | null;
};

export function IssueForm({ issue }: { issue?: IssueInput }) {
  const router = useRouter();
  const [cover, setCover] = useState<SelectedMedia | null>(
    issue?.cover ? { id: "", url: issue.cover.url, alt: issue.cover.alt ?? "" } : null,
  );
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    if (cover?.id) formData.set("coverId", cover.id);
    if (issue?.id) formData.set("id", issue.id);
    startTransition(async () => {
      const action = issue?.id ? updateIssueAction : createIssueAction;
      const res = await action(undefined, formData);
      setResult(res);
      if (!res.error) router.refresh();
      if (!res.error && !issue?.id) router.push("/admin/journal/issues");
    });
  }

  return (
    <form action={save} className="max-w-xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="volume">Volume</Label>
          <Input id="volume" name="volume" type="number" min={1} defaultValue={issue?.volume} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="number">Number</Label>
          <Input id="number" name="number" type="number" min={1} defaultValue={issue?.number} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year">Year</Label>
          <Input id="year" name="year" type="number" min={1900} defaultValue={issue?.year ?? new Date().getFullYear()} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" defaultValue={issue?.title ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Input id="description" name="description" defaultValue={issue?.description ?? ""} />
      </div>
      <MediaPicker folder="journal" existing={[]} value={cover} onChange={setCover} label="Cover image" />
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue={issue?.status ?? "DRAFT"} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
    </form>
  );
}
