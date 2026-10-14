"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HandbookPage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import {
  createHandbookPageAction,
  updateHandbookPageAction,
  listHandbookRevisionsAction,
  restoreHandbookPageAction,
} from "@/server/actions/handbook";

export function HandbookForm({
  page,
  topLevelPages,
}: {
  page: HandbookPage | null;
  topLevelPages: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [summary, setSummary] = useState(page?.summary ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [parentId, setParentId] = useState(page?.parentId ?? "");
  const [status, setStatus] = useState(page?.status ?? "DRAFT");
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      if (page) fd.set("id", page.id);
      fd.set("title", title);
      fd.set("slug", slug || title.toLowerCase().replace(/\s+/g, "-"));
      fd.set("summary", summary);
      fd.set("body", body);
      fd.set("parentId", parentId);
      fd.set("status", status);
      const action = page ? updateHandbookPageAction : createHandbookPageAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error && !page && res.id) router.push(`/admin/handbook/${res.id}`);
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{page ? page.title : "New handbook page"}</h1>
        {page ? (
          <VersionHistoryDialog
            listRevisions={() => listHandbookRevisionsAction(page.id)}
            onRestore={async (revisionId) => {
              const fd = new FormData();
              fd.set("id", page.id);
              fd.set("revisionId", revisionId);
              await restoreHandbookPageAction(fd);
              window.location.reload();
            }}
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Web address (slug)</Label>
        <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated from title if left blank" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="summary">Summary</Label>
        <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="parentId">Parent page (optional, maximum two levels)</Label>
        <select id="parentId" value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">No parent (top level)</option>
          {topLevelPages.filter((p) => p.id !== page?.id).map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Body</Label>
        <RichTextEditor initialHtml={body} onChange={setBody} existingMedia={[]} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {result?.error ? <p className="text-sm text-destructive" role="alert">{result.error}</p> : null}
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
