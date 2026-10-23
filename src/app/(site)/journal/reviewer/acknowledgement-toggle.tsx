"use client";

import { useTransition, useState } from "react";
import { setAcknowledgementOptInAction } from "@/server/actions/review-submission";

export function AcknowledgementToggle({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(checked: boolean) {
    setOptIn(checked);
    setError(null);
    startTransition(async () => {
      const result = await setAcknowledgementOptInAction(checked);
      if (result.error) {
        setOptIn(!checked);
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-6 rounded-md border border-border p-4">
      <h2 className="text-base font-semibold">Reviewer acknowledgement</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Allow your name to appear on the public yearly list of reviewers for this journal.
        Your identity is never linked to any specific manuscript.
      </p>
      <label className="mt-3 flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-primary"
          checked={optIn}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.checked)}
        />
        <span className="text-sm font-medium">
          {optIn ? "Listed as a reviewer this year" : "Not listed (private)"}
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
