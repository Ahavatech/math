"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Search, ChevronDown, ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import oauLogo from "../../../design-assets/oau-logo.png";
import type { NavLink } from "@/server/services/site-content";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { iconForHref, tabLabel, TAB_PRIORITY } from "@/lib/nav-icons";
import { parentPath } from "@/lib/parent-path";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Follows the page's large title: true once the title has scrolled up under
 * the bar, so the bar can show it in compact form (the way a large title
 * tucks into a navigation bar). Returns the title text too.
 */
function useTitleTucked(pathname: string) {
  const [state, setState] = useState<{ at: string; tucked: boolean; title: string }>({
    at: "",
    tucked: false,
    title: "",
  });

  useEffect(() => {
    // The page's large title: its h1, or the first heading if a page has none.
    const heading = document.querySelector<HTMLElement>("#main-content h1, #main-content h2");
    if (!heading) return;
    // The compact title is the page's own name ("About"), not the whole heading.
    const title = document.title.split("|")[0].trim() || heading.textContent?.trim() || "";
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Gone off the top (not merely below the fold).
        const tucked = !entry.isIntersecting && entry.boundingClientRect.top < 64;
        setState({ at: pathname, tucked, title });
      },
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname]);

  // Ignore a result left over from the previous page.
  return state.at === pathname ? state : { at: pathname, tucked: false, title: "" };
}

export function SiteHeader({ nav }: { nav: NavLink[] }) {
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so it closes by
  // itself when the route changes.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const menuOpen = openAt === pathname;
  const setMenuOpen = (open: boolean) => setOpenAt(open ? pathname : null);

  const { tucked, title } = useTitleTucked(pathname);
  const parent = parentPath(pathname);
  const parentLabel =
    parent === "/" ? "Home" : (nav.find((item) => item.href === parent)?.label ?? "Back");

  // Home plus the three most useful sections the department has in its menu.
  const tabs = [
    { href: "/", label: "Home" },
    ...TAB_PRIORITY.map((href) => nav.find((item) => item.href === href))
      .filter((item): item is NavLink => Boolean(item))
      .slice(0, 3)
      .map((item) => ({ href: item.href, label: tabLabel(item.label) })),
  ];

  // The tab bar needs the page to end above it (see globals.css).
  useEffect(() => {
    document.body.dataset.tabbar = "";
    return () => {
      delete document.body.dataset.tabbar;
    };
  }, []);

  return (
    <>
      <header
        data-site-header
        className="glass sticky top-0 z-40 border-b border-foreground/80"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-(--gutter) md:gap-4">
          {parent && parent !== pathname ? (
            <Link
              href={parent}
              className="-ml-2 inline-flex h-11 shrink-0 items-center gap-0.5 pr-2 pl-1 font-medium text-accent md:hidden"
              aria-label={`Back to ${parentLabel}`}
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
              <span className="max-w-24 truncate">{parentLabel}</span>
            </Link>
          ) : null}

          <Link
            href="/"
            className={`relative flex min-h-11 min-w-0 flex-1 items-center gap-3 min-[1366px]:flex-none ${
              parent ? "max-md:flex-none" : ""
            }`}
            aria-label="Department of Mathematics, home"
          >
            <Image src={oauLogo} alt="" aria-hidden="true" className="h-10 w-auto shrink-0" priority />
            <span
              className={`flex min-w-0 flex-col leading-tight transition-opacity duration-150 ${
                parent ? "max-md:hidden" : ""
              }`}
            >
              <span className="font-heading text-base leading-tight font-semibold sm:text-[1.0625rem]">
                Department of Mathematics
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:block">
                Obafemi Awolowo University
              </span>
            </span>
          </Link>

          {/* The large page title tucks into the bar once it scrolls away. */}
          {parent ? (
            <p
              className="bar-title min-w-0 flex-1 truncate text-center font-heading text-base font-semibold md:hidden"
              data-visible={tucked}
              aria-hidden="true"
            >
              {title}
            </p>
          ) : null}

          <nav aria-label="Primary" className="hidden min-[1366px]:block">
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
                    <ul className="invisible absolute left-0 top-full z-10 min-w-52 border border-foreground bg-popover py-1 opacity-0 shadow-[0_8px_16px_-8px_rgb(0_0_0/0.35)] transition-[opacity,visibility] duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
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
              className="inline-flex h-11 min-w-11 items-center justify-center gap-2 px-3 text-[0.9375rem] font-medium hover:text-accent"
            >
              <Search className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline min-[1366px]:hidden min-[1536px]:inline">Search</span>
              <span className="sr-only sm:hidden min-[1366px]:not-sr-only min-[1366px]:hidden">Search</span>
            </a>
            {/* From 768px the tab bar is gone, so the menu button is back. */}
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 border border-foreground px-3 text-[0.9375rem] font-medium transition-colors hover:bg-foreground hover:text-background max-md:hidden min-[1366px]:hidden"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-4" aria-hidden="true" />
              Menu
            </button>
          </div>
        </div>
      </header>

      {/* Phone navigation: a glass tab bar the page scrolls under. */}
      <nav
        aria-label="Sections"
        data-tabbar-nav
        className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-foreground/20 md:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            const Icon = iconForHref(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-[3.75rem] flex-col items-center justify-center gap-0.5 px-1 text-[0.8125rem] text-muted-foreground transition-colors aria-[current=page]:font-semibold aria-[current=page]:text-accent"
                >
                  <Icon className="size-6" aria-hidden="true" />
                  <span className="max-w-full truncate">{tab.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="flex h-[3.75rem] w-full flex-col items-center justify-center gap-0.5 px-1 text-[0.8125rem] text-muted-foreground transition-colors"
            >
              <Ellipsis className="size-6" aria-hidden="true" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* The full menu is a sheet: pull it down, tap outside, or press Escape. */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent variant="sheet" className="h-[min(88dvh,44rem)] content-start" showCloseButton>
          <DialogTitle className="font-heading text-2xl font-semibold">Menu</DialogTitle>
          <DialogDescription className="sr-only">All the sections of the department website.</DialogDescription>

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

          <nav aria-label="Primary (mobile)">
            <ul className="grouped">
              {nav.map((item) => {
                const Icon = iconForHref(item.href);
                return (
                  <li key={item.id} className="px-4">
                    <Link
                      href={item.href}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      className="flex min-h-14 items-center gap-3 text-lg font-medium aria-[current=page]:text-accent"
                    >
                      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
                    </Link>
                    {item.children.length > 0 ? (
                      <ul className="mb-2 grid gap-x-4 pl-8 sm:grid-cols-2">
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
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="font-medium">Appearance</span>
            <ThemeToggle />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
