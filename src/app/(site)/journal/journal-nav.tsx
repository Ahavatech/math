"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { label: "About", href: "/journal/about" },
  { label: "Articles", href: "/journal/articles" },
  { label: "Archive", href: "/journal/issues" },
  { label: "Editorial board", href: "/journal/editorial-board" },
  { label: "Guidelines", href: "/journal/guidelines" },
  { label: "Call for papers", href: "/journal/call-for-papers" },
  { label: "Policies", href: "/journal/policies" },
];

/**
 * The journal's own running head: its name, its sections, and the two
 * actions authors need. It scrolls sideways on narrow screens instead of
 * wrapping, so it stays one line tall.
 */
export function JournalNav({ name, submissionsOpen }: { name: string; submissionsOpen: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="border-b border-border bg-secondary/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-x-8 px-(--gutter) lg:flex-row lg:items-center">
        <Link
          href="/journal"
          className="shrink-0 pt-3 font-heading text-lg font-semibold hover:text-accent lg:py-2"
        >
          {name}
        </Link>
        <nav aria-label="Journal sections" className="-mx-(--gutter) overflow-x-auto px-(--gutter) [scrollbar-color:var(--accent)_transparent] [scrollbar-width:thin] lg:mx-0 lg:flex-1 lg:px-0">
          <ul className="flex min-w-max items-center">
            {SECTIONS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="relative inline-flex min-h-11 items-center pr-5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors hover:text-accent aria-[current=page]:text-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="ml-auto flex items-center gap-4 pl-4">
              <Link
                href="/journal/dashboard"
                className="link-rule inline-flex min-h-11 items-center text-[0.9375rem] font-medium whitespace-nowrap"
              >
                My submissions
              </Link>
              {submissionsOpen ? (
                <Link
                  href="/journal/submit"
                  className="inline-flex min-h-9 items-center bg-primary px-4 text-[0.9375rem] font-medium whitespace-nowrap text-primary-foreground transition-colors hover:bg-foreground"
                >
                  Submit a manuscript
                </Link>
              ) : null}
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
