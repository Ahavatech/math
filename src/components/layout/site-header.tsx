"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import oauLogo from "../../../design-assets/oau-logo.png";
import type { NavLink } from "@/server/services/site-content";

export function SiteHeader({ nav }: { nav: NavLink[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image src={oauLogo} alt="" aria-hidden="true" className="h-10 w-auto" priority />
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-base font-semibold">Department of Mathematics</span>
            <span className="text-xs text-muted-foreground">Obafemi Awolowo University</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) =>
              item.children.length > 0 ? (
                <li key={item.id} className="group relative">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                    aria-haspopup="true"
                  >
                    {item.label}
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </button>
                  <ul className="invisible absolute left-0 top-full z-10 min-w-48 rounded-md border border-border bg-popover p-1 opacity-0 shadow-md transition-[opacity,visibility] group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          className="block rounded-sm px-3 py-2 text-sm hover:bg-muted"
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
                    className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled
            title="Search is coming soon"
            aria-label="Search (coming soon)"
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <nav id="mobile-nav" aria-label="Primary (mobile)" className="border-t border-border lg:hidden">
          <ul className="flex flex-col px-4 py-2">
            {nav.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children.length > 0 ? (
                  <ul className="ml-3 border-l border-border pl-3">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted"
                          onClick={() => setMobileOpen(false)}
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
      ) : null}
    </header>
  );
}
