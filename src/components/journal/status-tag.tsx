export type StatusTone = "neutral" | "action" | "done" | "bad";

const TONES: Record<StatusTone, string> = {
  neutral: "border-foreground text-foreground",
  action: "border-accent bg-accent text-accent-foreground",
  done: "border-primary bg-primary text-primary-foreground",
  bad: "border-destructive text-destructive",
};

/**
 * A manuscript or review status as a small square label. The words carry
 * the meaning; the style only signals whether something needs the reader
 * (red fill), is finished (ink fill), has failed (red outline) or is
 * simply in progress (ink outline).
 */
export function StatusTag({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
