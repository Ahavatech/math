"use client";

import { useEffect, useState } from "react";

type State = "idle" | "copied" | "failed";

/**
 * Copies a value to the clipboard and says what happened, for screen
 * readers as well. If the browser refuses clipboard access it says so, so
 * nobody is left wondering whether the number was copied.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 3500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  const message =
    state === "copied"
      ? `${label} copied to the clipboard`
      : state === "failed"
        ? `Copying is not available in this browser. Select the ${label} above and copy it.`
        : "";

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center border border-foreground px-4 text-[0.9375rem] font-medium transition-colors hover:bg-foreground hover:text-background"
      >
        {state === "copied" ? "Copied" : `Copy ${label}`}
      </button>
      <p role="status" aria-live="polite" className={message ? "mt-2 text-sm text-muted-foreground" : "sr-only"}>
        {message}
      </p>
    </>
  );
}
