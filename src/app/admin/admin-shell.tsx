"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronLeft, Ellipsis, Menu } from "lucide-react";
import { AdminSidebar, isActiveAdminLink, type AdminNavItem } from "./admin-nav";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { adminIconForHref, ADMIN_TAB_PRIORITY } from "@/lib/admin-icons";
import { tabLabel } from "@/lib/nav-icons";

const STORAGE_KEY = "oau-admin-menu-hidden";
const CHANGE_EVENT = "oau-admin-menu-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/** Whether this person chose to hide the sidebar on a large screen (remembered in this browser). */
function useMenuHidden(): [boolean, (hidden: boolean) => void] {
  const hidden = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_KEY) === "1",
    () => false,
  );
  const setHidden = (value: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [hidden, setHidden];
}

/**
 * True once the page's large title has scrolled up under the bar, so the bar
 * can show the title in compact form (a large title that tucks into the bar).
 */
function useTitleTucked(pathname: string, root: React.RefObject<HTMLElement | null>) {
  const [state, setState] = useState<{ at: string; tucked: boolean }>({ at: "", tucked: false });

  useEffect(() => {
    const heading = root.current?.querySelector("h1");
    if (!heading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setState({ at: pathname, tucked: !entry.isIntersecting && entry.boundingClientRect.top < 64 });
      },
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname, root]);

  return state.at === pathname && state.tucked;
}

/**
 * The frame around every admin page. On a large screen: the sidebar (which can
 * be hidden and stays hidden, remembered in this browser) and a glass top bar.
 * On a phone or tablet: the same glass top bar, whose back button never
 * scrolls away and whose title appears once the large page title has tucked
 * under it, plus a glass tab bar at the bottom. The full menu opens as a
 * sheet you can pull down.
 */
export function AdminShell({
  items,
  headerRight,
  children,
}: {
  items: AdminNavItem[];
  headerRight: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [hidden, setHidden] = useMenuHidden();
  // The sheet is open only for the page it was opened on, so it closes by itself on navigation.
  const [sheetAt, setSheetAt] = useState<string | null>(null);
  const sheetOpen = sheetAt === pathname;
  const mainRef = useRef<HTMLElement>(null);
  const tucked = useTitleTucked(pathname, mainRef);

  const here = items.find((item) => isActiveAdminLink(pathname, item.href));
  // On a page below a listed page (an item's edit screen, say), offer the way
  // back to that list. A list page itself has no back link.
  const parent = (() => {
    const segments = pathname.split("/").filter(Boolean);
    for (let length = segments.length - 1; length >= 2; length--) {
      const href = "/" + segments.slice(0, length).join("/");
      const match = items.find((item) => item.href === href);
      if (match && href !== pathname) return match;
    }
    return null;
  })();

  // Dashboard plus the three most useful pages this person may open.
  const tabs = [
    items.find((item) => item.href === "/admin"),
    ...ADMIN_TAB_PRIORITY.map((href) => items.find((item) => item.href === href))
      .filter(Boolean)
      .slice(0, 3),
  ].filter((item): item is AdminNavItem => Boolean(item));

  useEffect(() => {
    document.body.dataset.tabbar = "";
    return () => {
      delete document.body.dataset.tabbar;
    };
  }, []);

  return (
    <div className="admin-shell min-h-screen bg-background lg:flex">
      <aside
        id="admin-sidebar"
        className={`hidden w-72 shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen ${hidden ? "lg:hidden" : ""} print:hidden`}
      >
        <AdminSidebar items={items} onHide={() => setHidden(true)} onNavigate={() => undefined} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-30 flex items-center gap-2 border-b border-border px-4 py-2 sm:gap-3 sm:px-6 lg:px-8">
          {/* Back: always in the bar on phones and tablets, so it never scrolls away. */}
          {parent ? (
            <Link
              href={parent.href}
              aria-label={`Back to ${parent.label}`}
              className="-ml-2 inline-flex h-11 shrink-0 items-center gap-0.5 pr-2 pl-1 font-medium text-accent lg:hidden"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
              <span className="max-w-28 truncate">{parent.label}</span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            className="inline-flex h-10 shrink-0 items-center gap-2 border border-foreground px-3 text-[0.9375rem] font-medium transition-colors hover:bg-foreground hover:text-background max-lg:hidden"
            aria-controls="admin-sidebar"
            aria-expanded={!hidden}
          >
            <Menu className="size-4" aria-hidden="true" />
            Menu
          </button>
          <p
            className={`bar-title min-w-0 flex-1 truncate font-heading text-lg font-semibold max-lg:text-center ${
              parent ? "" : "max-lg:text-left"
            }`}
            data-visible={tucked}
            data-desktop-visible="true"
          >
            {here ? here.label : "Admin"}
            {here && here.group !== "Overview" ? (
              <span className="ml-2 hidden text-[0.9375rem] font-normal text-muted-foreground lg:inline">{here.group}</span>
            ) : null}
          </p>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">{headerRight}</div>
        </header>

        <main ref={mainRef} className="admin-main mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          {parent ? (
            <Link href={parent.href} className="link-rule mb-4 inline-flex items-center gap-1.5 py-2 font-medium max-lg:hidden">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to {parent.label}
            </Link>
          ) : null}
          {children}
        </main>
      </div>

      {/* Phones and tablets: a glass tab bar the page scrolls under. */}
      <nav
        aria-label="Admin sections"
        data-tabbar-nav
        className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-foreground/20 lg:hidden"
      >
        <ul className={`mx-auto grid max-w-xl`} style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const active = tab.href === "/admin" ? pathname === "/admin" : isActiveAdminLink(pathname, tab.href);
            const Icon = adminIconForHref(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-[3.75rem] flex-col items-center justify-center gap-0.5 px-1 text-[0.8125rem] text-muted-foreground transition-colors aria-[current=page]:font-semibold aria-[current=page]:text-accent"
                >
                  <Icon className="size-6" aria-hidden="true" />
                  <span className="max-w-full truncate">{tab.href === "/admin" ? "Home" : tabLabel(tab.label)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setSheetAt(pathname)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className="flex h-[3.75rem] w-full flex-col items-center justify-center gap-0.5 px-1 text-[0.8125rem] text-muted-foreground transition-colors"
            >
              <Ellipsis className="size-6" aria-hidden="true" />
              <span>Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* The full menu as a sheet: pull it down, tap outside, or press Escape. */}
      <Dialog open={sheetOpen} onOpenChange={(open) => setSheetAt(open ? pathname : null)}>
        <DialogContent
          variant="sheet"
          showCloseButton
          className="h-[min(88dvh,46rem)] gap-0 overflow-hidden bg-chrome p-0 text-chrome-foreground ring-0 *:data-[slot=sheet-grabber]:m-0 [&_.sheet-handle]:bg-chrome-foreground/40 [&_[data-slot=dialog-close]]:text-chrome-foreground"
        >
          <DialogTitle className="sr-only">Admin menu</DialogTitle>
          <DialogDescription className="sr-only">Every admin page you can open.</DialogDescription>
          <div className="min-h-0 flex-1 overflow-hidden">
            <AdminSidebar items={items} showHide={false} onHide={() => setSheetAt(null)} onNavigate={() => setSheetAt(null)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
