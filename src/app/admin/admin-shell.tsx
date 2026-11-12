"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu } from "lucide-react";
import { AdminSidebar, isActiveAdminLink, type AdminNavItem } from "./admin-nav";

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

const DESKTOP_QUERY = "(min-width: 1024px)"; // Tailwind's lg: where the sidebar stops being a drawer

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener("change", callback);
      return () => query.removeEventListener("change", callback);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/**
 * The frame around every admin page: the sidebar, a top bar with the menu
 * button and where you are, and the page itself. On a large screen the
 * sidebar can be hidden to give the page the full width (and the choice is
 * remembered); on a phone it slides in over the page.
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
  const isDesktop = useIsDesktop();
  // The drawer is open only for the page it was opened on, so it closes by itself on navigation.
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const drawerOpen = drawerAt === pathname;

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

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  function toggleMenu() {
    if (isDesktop) setHidden(!hidden);
    else setDrawerAt(drawerOpen ? null : pathname);
  }

  const menuExpanded = isDesktop ? !hidden : drawerOpen;

  return (
    <div className="admin-shell min-h-screen bg-background lg:flex">
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 animate-in fade-in duration-200 lg:hidden"
          onClick={() => setDrawerAt(null)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-72 lg:shrink-0 lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        } ${hidden ? "lg:hidden" : ""} print:hidden`}
      >
        <AdminSidebar
          items={items}
          onHide={() => {
            if (isDesktop) setHidden(true);
            else setDrawerAt(null);
          }}
          onNavigate={() => setDrawerAt(null)}
        />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={toggleMenu}
            className="inline-flex h-10 shrink-0 items-center gap-2 border border-foreground px-3 text-[0.9375rem] font-medium transition-colors hover:bg-foreground hover:text-background"
            aria-controls="admin-sidebar"
            aria-expanded={menuExpanded}
          >
            <Menu className="size-4" aria-hidden="true" />
            Menu
          </button>
          <p className="min-w-0 flex-1 truncate font-heading text-lg font-semibold">
            {here ? here.label : "Admin"}
            {here && here.group !== "Overview" ? (
              <span className="ml-2 hidden text-[0.9375rem] font-normal text-muted-foreground sm:inline">{here.group}</span>
            ) : null}
          </p>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">{headerRight}</div>
        </header>
        <main className="admin-main mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          {parent ? (
            <Link href={parent.href} className="link-rule mb-4 inline-flex items-center gap-1.5 py-2 font-medium">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to {parent.label}
            </Link>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
