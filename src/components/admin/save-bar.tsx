import { cn } from "cn";
import { SavedMark } from "@/components/ui/saved-mark";

/**
 * The Save area of a long form. It sticks to the bottom of the screen, so
 * saving never means scrolling to the end of the page, and it says whether
 * there is anything unsaved. Put the form's feedback (errors, "Saved.") in
 * `children`; the Save button goes in `actions`.
 */
export function SaveBar({
  saved,
  dirty,
  actions,
  children,
  className,
}: {
  /** Shows the success mark (briefly) when a save has just worked. */
  saved?: boolean;
  dirty?: boolean;
  actions: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 mt-8 space-y-3 border-t-2 border-foreground bg-background py-3 lg:bottom-0",
        className,
      )}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {saved ? <SavedMark /> : null}
        {dirty ? (
          <span className="text-muted-foreground" role="status">
            You have unsaved changes.
          </span>
        ) : null}
      </div>
    </div>
  );
}
