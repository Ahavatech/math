"use client";

import { useState, useTransition } from "react";
import type { Page } from "@prisma/client";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  saveJournalPageAction,
  listJournalPageRevisionsAction,
  restoreJournalPageAction,
} from "@/server/actions/journal-pages";

export function JournalPageForm({ page }: { page: Page }) {
  const [body, setBody] = useState(page.body);
  const [status, setStatus] = useState(page.status);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", page.id);
      fd.set("title", page.title);
      fd.set("body", body);
      fd.set("status", status);
      const res = await saveJournalPageAction(undefined, fd);
      setResult(res);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Visible publicly only once this has real content (not the seeded placeholder).</span>
        <VersionHistoryDialog
          listRevisions={() => listJournalPageRevisionsAction(page.id)}
          onRestore={(revisionId) => restoreJournalPageAction(page.id, revisionId)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Body</Label>
        <RichTextEditor initialHtml={body} onChange={setBody} existingMedia={[]} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
    </div>
  );
}
