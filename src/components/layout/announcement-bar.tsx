export function AnnouncementBar({ message }: { message: string }) {
  return (
    <section aria-label="Announcement" className="bg-chrome text-sm text-chrome-foreground">
      <p className="mx-auto flex max-w-7xl items-baseline gap-3 px-(--gutter) py-2.5">
        <span className="shrink-0 bg-accent px-2 py-0.5 text-[0.8125rem] font-semibold tracking-wide text-accent-foreground uppercase">
          Notice
        </span>
        <span>{message}</span>
      </p>
    </section>
  );
}
