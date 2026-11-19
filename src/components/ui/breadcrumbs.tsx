import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="link-rule inline-flex items-center py-1 hover:text-foreground max-md:min-h-11 pointer-coarse:min-h-11"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="py-1 text-foreground max-md:inline-flex max-md:min-h-11 max-md:items-center pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-accent">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
