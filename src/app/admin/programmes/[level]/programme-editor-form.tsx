"use client";

import { useEffect, useState, useTransition } from "react";
import type { Programme } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import {
  saveProgrammeAction,
  listProgrammeRevisionsAction,
  restoreProgrammeAction,
} from "@/server/actions/programmes";

export function ProgrammeEditorForm({ programme }: { programme: Programme }) {
  const [title, setTitle] = useState(programme.title);
  const [summary, setSummary] = useState(programme.summary);
  const [body, setBody] = useState(programme.body);
  const [duration, setDuration] = useState(programme.duration);
  const [admissionRequirements, setAdmissionRequirements] = useState(programme.admissionRequirements);
  const [status, setStatus] = useState(programme.status);
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
      formData.set("id", programme.id);
      formData.set("title", title);
      formData.set("summary", summary);
      formData.set("body", body);
      formData.set("duration", duration);
      formData.set("admissionRequirements", admissionRequirements);
      formData.set("status", status);
      const res = await saveProgrammeAction(undefined, formData);
      setResult(res);
      if (!res.error) setDirty(false);
    });
  }

  return (
    <section className="space-y-4 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold">Programme details</h2>
        <VersionHistoryDialog
          listRevisions={() => listProgrammeRevisionsAction(programme.id)}
          onRestore={async (revisionId) => {
            const fd = new FormData();
            fd.set("id", programme.id);
            fd.set("revisionId", revisionId);
            await restoreProgrammeAction(fd);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="programme-title">Title</Label>
        <Input
          id="programme-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="programme-summary">Summary</Label>
        <Input
          id="programme-summary"
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Body</Label>
        <RichTextEditor
          initialHtml={body}
          existingMedia={[]}
          onChange={(html) => {
            setBody(html);
            setDirty(true);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="programme-duration">Duration</Label>
        <Input
          id="programme-duration"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Admission requirements</Label>
        <RichTextEditor
          initialHtml={admissionRequirements}
          existingMedia={[]}
          onChange={(html) => {
            setAdmissionRequirements(html);
            setDirty(true);
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="programme-status" className="shrink-0">
          Status
        </Label>
        <select
          id="programme-status"
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
    </section>
  );
}
