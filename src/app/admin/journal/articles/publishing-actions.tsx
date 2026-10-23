"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  publishArticleAction,
  scheduleArticleAction,
  correctArticleAction,
  retractArticleAction,
} from "@/server/actions/journal-articles";

type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CORRECTED" | "RETRACTED";

export function PublishingActions({ articleId, status }: { articleId: string; status: Status }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: string } | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [correctionNotice, setCorrectionNotice] = useState("");
  const [retractionReason, setRetractionReason] = useState("");

  function handleResult(res: { error?: string; success?: boolean }) {
    if (res.error) setResult({ error: res.error });
    else { setResult({ success: "Done." }); router.refresh(); }
  }

  return (
    <div className="mt-6 rounded-md border border-border p-4 space-y-4">
      <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">Publishing</h2>

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>{result.success}</AlertDescription></Alert> : null}

      {/* Publish (DRAFT or SCHEDULED → PUBLISHED) */}
      {(status === "DRAFT" || status === "SCHEDULED") ? (
        <div className="space-y-1">
          <Button
            variant="default"
            disabled={pending}
            onClick={() => startTransition(async () => handleResult(await publishArticleAction(articleId)))}
          >
            Publish now
          </Button>
          <p className="text-xs text-muted-foreground">Validates checklist, marks manuscript PUBLISHED, notifies authors.</p>
        </div>
      ) : null}

      {/* Schedule (DRAFT or SCHEDULED → SCHEDULED) */}
      {(status === "DRAFT" || status === "SCHEDULED") ? (
        <div className="space-y-1.5">
          <Label htmlFor="scheduledFor" className="text-sm">Schedule for</Label>
          <div className="flex gap-2">
            <Input
              id="scheduledFor"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              disabled={pending || !scheduledFor}
              onClick={() => startTransition(async () => handleResult(await scheduleArticleAction(articleId, scheduledFor)))}
            >
              Schedule
            </Button>
          </div>
        </div>
      ) : null}

      {/* Correct (PUBLISHED or CORRECTED → CORRECTED) */}
      {(status === "PUBLISHED" || status === "CORRECTED") ? (
        <div className="space-y-1.5">
          <Label htmlFor="correctionNotice" className="text-sm">Add correction notice</Label>
          <textarea
            id="correctionNotice"
            rows={3}
            value={correctionNotice}
            onChange={(e) => setCorrectionNotice(e.target.value)}
            placeholder="Describe what was corrected and when..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            disabled={pending || !correctionNotice.trim()}
            onClick={() => startTransition(async () => { handleResult(await correctArticleAction(articleId, correctionNotice)); setCorrectionNotice(""); })}
          >
            Add correction
          </Button>
        </div>
      ) : null}

      {/* Retract (PUBLISHED or CORRECTED → RETRACTED) */}
      {(status === "PUBLISHED" || status === "CORRECTED") ? (
        <div className="space-y-1.5">
          <Label htmlFor="retractionReason" className="text-sm">Retract article</Label>
          <textarea
            id="retractionReason"
            rows={3}
            value={retractionReason}
            onChange={(e) => setRetractionReason(e.target.value)}
            placeholder="Reason for retraction (required)..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button
            variant="destructive"
            disabled={pending || !retractionReason.trim()}
            onClick={() => startTransition(async () => { handleResult(await retractArticleAction(articleId, retractionReason)); setRetractionReason(""); })}
          >
            Retract
          </Button>
          <p className="text-xs text-muted-foreground">The article page stays visible with a retraction notice.</p>
        </div>
      ) : null}

      {status === "RETRACTED" ? (
        <p className="text-sm text-muted-foreground">This article has been retracted. Its page remains visible.</p>
      ) : null}
    </div>
  );
}
