"use client";

import { useEffect, useState, useTransition } from "react";
import type { MediaAsset, Page } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { savePageAction } from "@/server/actions/pages";

export function PageEditorForm({
  page,
  existingMedia,
}: {
  page: Page;
  existingMedia: MediaAsset[];
}) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [status, setStatus] = useState(page.status);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function save() {
    setResult(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", page.id);
      formData.set("title", title);
      formData.set("body", body);
      formData.set("status", status);
      const res = await savePageAction(undefined, formData);
      setResult(res);
      if (!res.error) setDirty(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Body</Label>
        <RichTextEditor
          initialHtml={body}
          existingMedia={existingMedia}
          onChange={(html) => {
            setBody(html);
            setDirty(true);
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="status" className="shrink-0">
          Status
        </Label>
        <select
          id="status"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setDirty(true);
          }}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <a
          href={`/${page.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          Preview on site
        </a>
      </div>

      {result?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}
      {result?.success ? (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      ) : null}
      {dirty && !result?.success ? (
        <p className="text-xs text-muted-foreground">You have unsaved changes.</p>
      ) : null}

      <Button onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
