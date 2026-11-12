"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Search, ChevronDown, ArrowRight } from "lucide-react";
import oauLogo from "../../../design-assets/oau-logo.png";
import type { NavLink } from "@/server/services/site-content";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ nav }: { nav: NavLink[] }) {
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so it closes by
  // itself when the route changes.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const mobileOpen = openAt === pathname;
  const setMobileOpen = (open: boolean) => setOpenAt(open ? pathname : null);

  // While the menu is open: lock page scroll and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  return (
    <header
      data-site-header
      className="sticky top-0 z-40 border-b border-foreground bg-background"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-(--gutter)">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 xl:flex-none">
          <Image src={oauLogo} alt="" aria-hidden="true" className="h-10 w-auto shrink-0" priority />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-heading text-base leading-tight font-semibold sm:text-[1.0625rem]">
              Department of Mathematics
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              Obafemi Awolowo University
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              const linkClass =
                "relative block px-2.5 py-2 text-[0.9375rem] font-medium transition-colors hover:text-accent after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-200 hover:after:scale-x-100 data-[active=true]:after:scale-x-100";
              return item.children.length > 0 ? (
                <li key={item.id} className="group relative">
                  <button
                    type="button"
                    className={`${linkClass} flex items-center gap-1`}
                    aria-haspopup="true"
                    data-active={active}
                  >
                    {item.label}
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <ul className="invisible absolute left-0 top-full z-10 min-w-52 border border-foreground bg-popover py-1 opacity-0 shadow-[0_8px_16px_-8px_rgb(13_22_38/0.25)] transition-[opacity,visibility] duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          className="block px-4 py-2.5 text-[0.9375rem] hover:bg-secondary hover:text-accent"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={linkClass}
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <a
            href="/search"
            className="inline-flex h-10 items-center gap-2 px-3 text-[0.9375rem] font-medium hover:text-accent"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <span className="sr-only sm:hidden">Search</span>
          </a>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 border border-foreground px-3 text-[0.9375rem] font-medium transition-colors hover:bg-foreground hover:text-background xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Menu className="size-4" aria-hidden="true" />
            )}
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-y-auto bg-background animate-in fade-in slide-in-from-top-2 duration-200 xl:hidden"
        >
          <div className="mx-auto max-w-6xl px-(--gutter) pt-5 pb-12">
            <form action="/search" method="get" role="search" className="flex">
              <label htmlFor="mobile-search" className="sr-only">
                Search the site
              </label>
              <input
                id="mobile-search"
                type="search"
                name="q"
                placeholder="Search staff, courses, news"
                minLength={2}
                className="h-12 min-w-0 flex-1 border border-input bg-background px-4 text-base"
              />
              <button
                type="submit"
                className="inline-flex h-12 items-center gap-2 bg-primary px-5 text-base font-medium text-primary-foreground"
              >
                <Search className="size-4" aria-hidden="true" />
                Search
              </button>
            </form>

            <nav aria-label="Primary (mobile)" className="mt-6">
              <ul>
                {nav.map((item) => (
                  <li key={item.id} className="border-t border-border">
                    <Link
                      href={item.href}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      className="flex min-h-14 items-center justify-between gap-3 font-heading text-2xl font-semibold aria-[current=page]:text-accent"
                    >
                      {item.label}
                      <ArrowRight className="size-5 text-muted-foreground" aria-hidden="true" />
                    </Link>
                    {item.children.length > 0 ? (
                      <ul className="mb-3 grid gap-x-4 sm:grid-cols-2">
                        {item.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={child.href}
                              className="flex min-h-11 items-center text-base text-muted-foreground hover:text-accent"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
