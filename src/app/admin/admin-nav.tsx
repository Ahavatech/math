"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export type AdminNavItem = { label: string; href: string; group: string };

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The admin sidebar: grouped links with the current page marked in ink.
 * On screens narrower than 1024px it collapses behind a labelled Menu
 * button above the page instead of squeezing the content.
 */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  // Open only for the page it was opened on, so it closes on navigation.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  const groups: Array<{ name: string; items: AdminNavItem[] }> = [];
  for (const item of items) {
    const group = groups.find((g) => g.name === item.group);
    if (group) group.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  return (
    <aside className="border-b border-foreground bg-secondary/60 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:pt-5 lg:pb-3">
        <Link href="/admin" className="font-heading text-lg leading-tight font-semibold">
          OAU Mathematics
          <span className="block text-sm font-normal text-muted-foreground">Admin</span>
        </Link>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 border border-foreground bg-background px-3 text-[0.9375rem] font-medium lg:hidden"
          aria-expanded={open}
          aria-controls="admin-nav"
          onClick={() => setOpenAt(open ? null : pathname)}
        >
          {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <nav
        id="admin-nav"
        aria-label="Admin"
        className={`${open ? "block" : "hidden"} px-3 pb-6 lg:block`}
      >
        {groups.map((group) => (
          <div key={group.name} className="mt-4 first:mt-0">
            <p className="px-2 pb-1 text-sm font-semibold text-muted-foreground">{group.name}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    className="flex min-h-10 items-center px-2 text-[0.9375rem] transition-colors hover:bg-background aria-[current=page]:bg-foreground aria-[current=page]:font-medium aria-[current=page]:text-background"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
