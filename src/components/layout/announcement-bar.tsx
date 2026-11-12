export function AnnouncementBar({ message }: { message: string }) {
  return (
    <div className="bg-foreground text-sm text-background">
      <p className="mx-auto flex max-w-6xl items-baseline gap-3 px-(--gutter) py-2.5">
        <span className="shrink-0 bg-accent px-2 py-0.5 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
          Notice
        </span>
        <span>{message}</span>
      </p>
    </div>
  );
}
