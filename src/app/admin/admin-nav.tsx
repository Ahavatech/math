"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronsLeft,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Newspaper,
  Search,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import oauLogo from "../../../design-assets/oau-logo.png";

export type AdminNavItem = { label: string; href: string; group: string };

const GROUP_ICONS: Record<string, LucideIcon> = {
  Overview: LayoutDashboard,
  Website: Globe,
  Academics: GraduationCap,
  People: Users,
  "News and events": Newspaper,
  Journal: BookOpen,
  Account: UserCircle,
};

export function isActiveAdminLink(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The admin sidebar. Ink background, the department mark, groups that fold
 * away (only the group you are in is open to begin with, so the list stays
 * short), a jump box that filters every page by name, and a button to hide
 * the whole sidebar. Press "/" anywhere to jump to the search box.
 */
export function AdminSidebar({
  items,
  onHide,
  onNavigate,
}: {
  items: AdminNavItem[];
  /** Hides the sidebar (desktop) or closes the drawer (phone). */
  onHide: () => void;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // Groups the person has opened or closed by hand, on top of the one they are in.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const result: Array<{ name: string; items: AdminNavItem[] }> = [];
    for (const item of items) {
      const group = result.find((g) => g.name === item.group);
      if (group) group.items.push(item);
      else result.push({ name: item.group, items: [item] });
    }
    return result;
  }, [items]);

  const activeGroup = items.find((item) => isActiveAdminLink(pathname, item.href))?.group;
  const isOpen = (name: string) => toggled[name] ?? name === activeGroup;

  // "/" jumps to the search box, unless the person is already typing somewhere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? items.filter((item) => item.label.toLowerCase().includes(trimmed) || item.group.toLowerCase().includes(trimmed))
    : [];

  const linkClass =
    "flex min-h-10 items-center px-3 text-[0.9375rem] text-background/85 transition-colors hover:bg-background/10 hover:text-background aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground";

  return (
    <div className="flex h-full flex-col bg-foreground text-background">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link href="/admin" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center bg-background">
            <Image src={oauLogo} alt="" aria-hidden="true" className="h-9 w-auto" />
          </span>
          <span className="min-w-0 font-heading text-lg leading-tight font-semibold">
            Mathematics
            <span className="block text-sm font-normal text-background/70">Admin</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onHide}
          className="inline-flex size-10 shrink-0 items-center justify-center text-background/80 transition-colors hover:bg-background/10 hover:text-background"
          aria-label="Hide the menu"
        >
          <ChevronsLeft className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <label htmlFor={searchId} className="sr-only">
          Jump to a page
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-background/60" aria-hidden="true" />
          <input
            id={searchId}
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a page (press /)"
            autoComplete="off"
            className="h-10 w-full border border-background/30 bg-background/10 pr-3 pl-9 text-[0.9375rem] text-background placeholder:text-background/60 focus-visible:border-background focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
          />
        </div>
      </div>

      <nav id="admin-nav" aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {trimmed ? (
          matches.length > 0 ? (
            <ul>
              {matches.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      setQuery("");
                      onNavigate();
                    }}
                    aria-current={isActiveAdminLink(pathname, item.href) ? "page" : undefined}
                    className={linkClass}
                  >
                    <span>
                      {item.label}
                      <span className="ml-2 text-sm text-background/60">{item.group}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-[0.9375rem] text-background/70">No page matches &ldquo;{query}&rdquo;.</p>
          )
        ) : (
          groups.map((group) => {
            const Icon = GROUP_ICONS[group.name] ?? LayoutDashboard;
            // A group with one page (the dashboard) is just a link.
            if (group.items.length === 1) {
              const only = group.items[0];
              return (
                <Link
                  key={group.name}
                  href={only.href}
                  onClick={onNavigate}
                  aria-current={isActiveAdminLink(pathname, only.href) ? "page" : undefined}
                  className={`${linkClass} gap-3 font-medium`}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {only.label}
                </Link>
              );
            }
            const open = isOpen(group.name);
            const listId = `admin-group-${group.name.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <div key={group.name} className="mt-1">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => setToggled((previous) => ({ ...previous, [group.name]: !open }))}
                  className="flex min-h-10 w-full items-center gap-3 px-3 text-left text-[0.9375rem] font-medium text-background transition-colors hover:bg-background/10"
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{group.name}</span>
                  <span className="text-sm text-background/60">{group.items.length}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-background/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {open ? (
                  <ul id={listId} className="mt-0.5 mb-1 ml-5 border-l border-background/20 pl-2">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={isActiveAdminLink(pathname, item.href) ? "page" : undefined}
                          className={linkClass}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
