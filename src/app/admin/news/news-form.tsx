"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MediaAsset, NewsPost } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MediaPicker, type SelectedMedia } from "@/components/admin/media-picker";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import { createNewsPostAction, updateNewsPostAction, listNewsRevisionsAction, restoreNewsPostAction } from "@/server/actions/news";
import { utcToWatLocalInput } from "@/lib/time";

type ExistingPost = NewsPost & { cover: MediaAsset | null };

export function NewsForm({ post, existingMedia }: { post: ExistingPost | null; existingMedia: MediaAsset[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [category, setCategory] = useState(post?.category ?? "ANNOUNCEMENT");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [cover, setCover] = useState<SelectedMedia | null>(
    post?.cover ? { id: post.cover.id, url: post.cover.url, alt: post.cover.alt ?? "" } : null,
  );
  const [isPinned, setIsPinned] = useState(post?.isPinned ?? false);
  const [status, setStatus] = useState(post?.status ?? "DRAFT");
  const [publishedAt, setPublishedAt] = useState(post?.publishedAt ? utcToWatLocalInput(post.publishedAt) : "");
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
      const fd = new FormData();
      if (post) fd.set("id", post.id);
      fd.set("title", title);
      fd.set("slug", slug);
      fd.set("category", category);
      fd.set("excerpt", excerpt);
      fd.set("body", body);
      fd.set("coverId", cover?.id ?? "");
      fd.set("isPinned", String(isPinned));
      fd.set("status", status);
      if (publishedAt) fd.set("publishedAt", publishedAt);
      const action = post ? updateNewsPostAction : createNewsPostAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error) {
        setDirty(false);
        if (!post && res.id) router.push(`/admin/news/${res.id}`);
      }
    });
  }

  const canEditSlug = !post || post.status !== "PUBLISHED";

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{post ? post.title : "New post"}</h1>
        {post ? (
          <VersionHistoryDialog
            listRevisions={() => listNewsRevisionsAction(post.id)}
            onRestore={async (revisionId) => {
              const fd = new FormData();
              fd.set("id", post.id);
              fd.set("revisionId", revisionId);
              await restoreNewsPostAction(fd);
            }}
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="news-title">Title</Label>
        <Input id="news-title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="news-slug">Slug {!canEditSlug ? "(locked after publishing - changing it redirects the old address)" : ""}</Label>
        <Input id="news-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setDirty(true); }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="news-category">Category</Label>
          <select
            id="news-category"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={category}
            onChange={(e) => { setCategory(e.target.value as typeof category); setDirty(true); }}
          >
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="ACHIEVEMENT">Achievement</option>
            <option value="ADMISSION">Admission</option>
            <option value="RESEARCH">Research</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="news-status">Status</Label>
          <select
            id="news-status"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setDirty(true); }}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="news-excerpt">Excerpt (max 300 characters)</Label>
        <Input id="news-excerpt" maxLength={300} value={excerpt} onChange={(e) => { setExcerpt(e.target.value); setDirty(true); }} />
      </div>

      <MediaPicker folder="news" existing={existingMedia} value={cover} onChange={(m) => { setCover(m); setDirty(true); }} label="Cover image" />

      <div className="space-y-1.5">
        <Label>Body</Label>
        <RichTextEditor initialHtml={body} existingMedia={existingMedia} onChange={(html) => { setBody(html); setDirty(true); }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="news-published-at">Published date/time (WAT) - leave blank to publish immediately on save</Label>
          <Input id="news-published-at" type="datetime-local" value={publishedAt} onChange={(e) => { setPublishedAt(e.target.value); setDirty(true); }} />
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={isPinned} onChange={(e) => { setIsPinned(e.target.checked); setDirty(true); }} />
          Pinned (shows first in the list)
        </label>
      </div>

      {post?.status === "DRAFT" ? (
        <a href={`/news/${post.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
          View as public (preview)
        </a>
      ) : null}

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      {dirty && !result?.success ? <p className="text-xs text-muted-foreground">You have unsaved changes.</p> : null}

      <Button onClick={save} disabled={pending || !title.trim() || !slug.trim()}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
