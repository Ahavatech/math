import Link from "next/link";

export type FilterLinkItem = { label: string; href: string; active: boolean };

/**
 * A row of filter choices that are real links (so they work without
 * script and can be shared). The active choice is announced with
 * aria-current and shown filled with ink.
 */
export function FilterLinks({ label, items }: { label: string; items: FilterLinkItem[] }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "true" : undefined}
              className="inline-flex min-h-10 items-center border border-foreground px-3.5 text-[0.9375rem] font-medium transition-colors hover:bg-secondary aria-[current=true]:bg-foreground aria-[current=true]:text-background"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Two or three views of the same list (for example Upcoming and Past). */
export function UnderlineTabs({ label, items }: { label: string; items: FilterLinkItem[] }) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-8 border-b border-border">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className="relative inline-flex min-h-12 items-center font-heading text-xl font-semibold text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-200 aria-[current=page]:after:scale-x-100"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Previous / Next links with the page position between them. */
export function PageNav({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <nav
      className="mt-10 flex items-center justify-between gap-4 border-t-2 border-foreground pt-4"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="link-rule py-2 font-medium">
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="tabular text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="link-rule py-2 font-medium">
          Next
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
