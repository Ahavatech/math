import { cn } from "cn";

/**
 * The Save area of a long form. It sticks to the bottom of the screen, so
 * saving never means scrolling to the end of the page, and it says whether
 * there is anything unsaved. Put the form's feedback (errors, "Saved.") in
 * `children`; the Save button goes in `actions`.
 */
export function SaveBar({
  dirty,
  actions,
  children,
  className,
}: {
  dirty?: boolean;
  actions: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 mt-8 space-y-3 border-t-2 border-foreground bg-background py-3",
        className,
      )}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {dirty ? (
          <span className="text-muted-foreground" role="status">
            You have unsaved changes.
          </span>
        ) : null}
      </div>
    </div>
  );
}
