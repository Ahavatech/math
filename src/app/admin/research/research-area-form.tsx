"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MediaAsset, ResearchArea } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MediaPicker, type SelectedMedia } from "@/components/admin/media-picker";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import {
  createResearchAreaAction,
  updateResearchAreaAction,
  listResearchAreaRevisionsAction,
  restoreResearchAreaAction,
} from "@/server/actions/research-areas";

type ExistingArea = ResearchArea & { image: MediaAsset | null };

export function ResearchAreaForm({
  area,
  existingMedia,
}: {
  area: ExistingArea | null;
  existingMedia: MediaAsset[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(area?.title ?? "");
  const [summary, setSummary] = useState(area?.summary ?? "");
  const [body, setBody] = useState(area?.body ?? "");
  const [status, setStatus] = useState(area?.status ?? "DRAFT");
  const [image, setImage] = useState<SelectedMedia | null>(
    area?.image ? { id: area.image.id, url: area.image.url, alt: area.image.alt ?? "" } : null,
  );
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
      if (area) fd.set("id", area.id);
      fd.set("title", title);
      fd.set("summary", summary);
      fd.set("body", body);
      fd.set("status", status);
      fd.set("imageId", image?.id ?? "");
      const action = area ? updateResearchAreaAction : createResearchAreaAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error) {
        setDirty(false);
        if (!area && res.id) router.push(`/admin/research/${res.id}`);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{area ? area.title : "New research area"}</h1>
        {area ? (
          <VersionHistoryDialog
            listRevisions={() => listResearchAreaRevisionsAction(area.id)}
            onRestore={async (revisionId) => {
              const fd = new FormData();
              fd.set("id", area.id);
              fd.set("revisionId", revisionId);
              await restoreResearchAreaAction(fd);
            }}
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="research-title">Title</Label>
        <Input
          id="research-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="research-summary">Summary</Label>
        <Input
          id="research-summary"
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <MediaPicker
        folder="research"
        existing={existingMedia}
        value={image}
        onChange={(m) => {
          setImage(m);
          setDirty(true);
        }}
        label="Image"
      />

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
        <Label htmlFor="research-status" className="shrink-0">
          Status
        </Label>
        <select
          id="research-status"
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
        {area ? (
          <a
            href={`/research/${area.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            Preview on site
          </a>
        ) : null}
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

      <Button onClick={save} disabled={pending || !title.trim()}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
