"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { hapticSuccess } from "@/lib/haptics";

/**
 * Success you can see. A check mark pops in and draws itself, with a haptic
 * tick on phones that support it. The wording is kept for screen readers
 * only (it is a live region), so nothing is "announced" on screen: the mark
 * is the message.
 */
export function SavedMark({
  label = "Saved",
  className = "",
  visibleMs = 2600,
}: {
  label?: string;
  className?: string;
  /** How long the mark stays before it fades away. */
  visibleMs?: number;
}) {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    hapticSuccess();
    if (!Number.isFinite(visibleMs)) return;
    const timer = window.setTimeout(() => setShown(false), visibleMs);
    return () => window.clearTimeout(timer);
  }, [visibleMs]);

  if (!shown) return null;

  return (
    <span className={`pop-in inline-flex items-center ${className}`} role="status">
      <span className="check-draw inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
