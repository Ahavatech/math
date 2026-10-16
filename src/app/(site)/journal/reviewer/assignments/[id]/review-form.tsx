"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveDraftReviewAction, submitReviewAction } from "@/server/actions/review-submission";

interface ReviewFormProps {
  assignmentId: string;
  initialData?: {
    recommendation?: string;
    commentsToAuthor?: string;
    commentsToEditor?: string;
  };
  isSubmitted: boolean;
}

const RECOMMENDATIONS = [
  { value: "ACCEPT", label: "Accept" },
  { value: "MINOR_REVISION", label: "Minor revision" },
  { value: "MAJOR_REVISION", label: "Major revision" },
  { value: "REJECT", label: "Reject" },
];

export function ReviewForm({ assignmentId, initialData, isSubmitted }: ReviewFormProps) {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState(initialData?.recommendation ?? "");
  const [commentsToAuthor, setCommentsToAuthor] = useState(initialData?.commentsToAuthor ?? "");
  const [commentsToEditor, setCommentsToEditor] = useState(initialData?.commentsToEditor ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const saveDraft = useCallback(async () => {
    if (isSubmitted) return;
    setSaveStatus("saving");
    const fd = new FormData();
    fd.append("assignmentId", assignmentId);
    if (recommendation) fd.append("recommendation", recommendation);
    if (commentsToAuthor) fd.append("commentsToAuthor", commentsToAuthor);
    if (commentsToEditor) fd.append("commentsToEditor", commentsToEditor);
    const result = await saveDraftReviewAction(fd);
    setSaveStatus(result.error ? "error" : "saved");
    setTimeout(() => setSaveStatus("idle"), 3000);
  }, [assignmentId, recommendation, commentsToAuthor, commentsToEditor, isSubmitted]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("assignmentId", assignmentId);
      fd.append("recommendation", recommendation);
      fd.append("commentsToAuthor", commentsToAuthor);
      if (commentsToEditor) fd.append("commentsToEditor", commentsToEditor);
      const result = await submitReviewAction(fd);
      if (result.error) {
        setSubmitError(result.error);
      } else {
        router.push("/journal/reviewer");
      }
    });
  }

  if (isSubmitted) {
    return (
      <div className="rounded-lg border p-6 bg-muted/30">
        <p className="font-medium text-green-700">This review has been submitted and is locked.</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium">Recommendation</dt>
            <dd>{initialData?.recommendation ?? "-"}</dd>
          </div>
          <div>
            <dt className="font-medium">Comments to author</dt>
            <dd className="whitespace-pre-wrap">{initialData?.commentsToAuthor ?? "-"}</dd>
          </div>
          {initialData?.commentsToEditor && (
            <div>
              <dt className="font-medium">Confidential comments to editor</dt>
              <dd className="whitespace-pre-wrap">{initialData.commentsToEditor}</dd>
            </div>
          )}
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="recommendation">
          Recommendation <span className="text-destructive">*</span>
        </label>
        <select
          id="recommendation"
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          className="block w-full border rounded-md px-3 py-2 text-sm"
          required
        >
          <option value="">Select a recommendation</option>
          {RECOMMENDATIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="commentsToAuthor">
          Comments to author <span className="text-destructive">*</span>
        </label>
        <textarea
          id="commentsToAuthor"
          value={commentsToAuthor}
          onChange={(e) => setCommentsToAuthor(e.target.value)}
          onBlur={saveDraft}
          rows={10}
          className="block w-full border rounded-md px-3 py-2 text-sm"
          required
          placeholder="Your comments will be shared with the author."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="commentsToEditor">
          Confidential comments to editor (optional)
        </label>
        <textarea
          id="commentsToEditor"
          value={commentsToEditor}
          onChange={(e) => setCommentsToEditor(e.target.value)}
          onBlur={saveDraft}
          rows={4}
          className="block w-full border rounded-md px-3 py-2 text-sm"
          placeholder="These comments will not be shared with the author."
        />
      </div>

      {saveStatus === "saving" && (
        <p className="text-xs text-muted-foreground">Saving draft...</p>
      )}
      {saveStatus === "saved" && (
        <p className="text-xs text-green-600">Draft saved</p>
      )}
      {saveStatus === "error" && (
        <p className="text-xs text-destructive">Failed to save draft</p>
      )}

      {submitError && (
        <p className="text-sm text-destructive">{submitError}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={saveDraft}
          disabled={isPending}
          className="px-4 py-2 border rounded-md text-sm font-medium"
        >
          Save draft
        </button>
        <button
          type="submit"
          disabled={isPending || !recommendation || !commentsToAuthor.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
        >
          Submit review
        </button>
      </div>
    </form>
  );
}
