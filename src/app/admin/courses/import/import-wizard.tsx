"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { dryRunCourseImportAction, commitCourseImportAction } from "@/server/actions/courses";
import type { CourseImportValidationResult } from "@/lib/course-import";

export function CourseImportWizard() {
  const [dryRun, setDryRun] = useState<CourseImportValidationResult | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    setDryRun(null);
    setCreated(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      startTransition(async () => {
        try {
          const result = await dryRunCourseImportAction(text);
          setDryRun(result);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not read this file");
        }
      });
    };
    reader.readAsText(file);
  }

  function commit() {
    if (!dryRun) return;
    startTransition(async () => {
      const result = await commitCourseImportAction(dryRun.validRows);
      setCreated(result.created);
    });
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {dryRun ? (
        <div className="space-y-3">
          <p className="text-sm">
            {dryRun.validRows.length} valid row(s), {dryRun.errors.length} error(s).
          </p>
          {dryRun.errors.length > 0 ? (
            <ul className="space-y-1 text-sm text-destructive">
              {dryRun.errors.map((e) => (
                <li key={e.row}>Row {e.row}: {e.reason}</li>
              ))}
            </ul>
          ) : null}
          {dryRun.validRows.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {dryRun.validRows.map((r) => (
                <li key={r.row}>Row {r.row}: {r.code} - {r.title}</li>
              ))}
            </ul>
          ) : null}
          {created === null && dryRun.validRows.length > 0 ? (
            <Button type="button" onClick={commit} disabled={pending}>
              {pending ? "Creating..." : `Create ${dryRun.validRows.length} course(s) as drafts`}
            </Button>
          ) : null}
          {created !== null ? <p className="text-sm font-medium">Created {created} course(s) as drafts.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
