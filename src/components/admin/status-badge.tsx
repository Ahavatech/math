import { humanise } from "@/lib/labels";

const STYLES: Record<string, string> = {
  // Live on the website: solid ink.
  PUBLISHED: "border-primary bg-primary text-primary-foreground",
  ACTIVE: "border-primary bg-primary text-primary-foreground",
  APPROVED: "border-primary bg-primary text-primary-foreground",
  // Not live yet: a dashed outline reads as "work in progress".
  DRAFT: "border-dashed border-foreground/60 bg-background text-foreground",
  PENDING: "border-dashed border-foreground/60 bg-background text-foreground",
  // Needs a person: red.
  NEW: "border-accent bg-accent text-accent-foreground",
  REJECTED: "border-destructive bg-background text-destructive",
  // Set aside.
  ARCHIVED: "border-border bg-muted text-muted-foreground",
  WITHDRAWN: "border-border bg-muted text-muted-foreground",
};

/**
 * A content or record status as a small square label. The word is always
 * shown; the style only helps scanning a long list: solid ink is live, a
 * dashed outline is unfinished, red needs attention, grey is set aside.
 */
export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? "border-border bg-secondary text-secondary-foreground";
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center border px-2 text-[0.8125rem] font-medium whitespace-nowrap ${style}`}
    >
      {humanise(status)}
    </span>
  );
}
