import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission, type Permission } from "@/lib/rbac";
import { logoutAction } from "@/server/actions/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

type NavItem = {
  label: string;
  href: string;
  permission: Permission | null;
  implemented: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", permission: null, implemented: true },
  { label: "Users", href: "/admin/users", permission: "users.manage", implemented: true },
  { label: "Site content", href: "/admin/site", permission: "site.edit", implemented: true },
  { label: "Navigation", href: "/admin/navigation", permission: "site.edit", implemented: true },
  { label: "Pages", href: "/admin/pages", permission: "site.edit", implemented: true },
  { label: "Media", href: "/admin/media", permission: "site.edit", implemented: true },
  { label: "Programmes", href: "/admin/programmes", permission: "site.edit", implemented: true },
  { label: "Research", href: "/admin/research", permission: "site.edit", implemented: true },
  {
    label: "Lecturers",
    href: "/admin/lecturers",
    permission: "lecturers.manage",
    implemented: false,
  },
  { label: "News", href: "/admin/news", permission: "news.manage", implemented: false },
  { label: "Events", href: "/admin/events", permission: "events.manage", implemented: false },
  { label: "Alumni", href: "/admin/alumni", permission: "alumni.review", implemented: false },
  { label: "Journal", href: "/admin/journal", permission: "journal.edit", implemented: false },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect("/login");
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === null || hasPermission(user, item.permission),
  );

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r p-4">
        <p className="mb-4 text-sm font-semibold">OAU Mathematics</p>
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) =>
            item.implemented ? (
              <Link
                key={item.href}
                href={item.href}
                className="hover:bg-muted rounded-md px-2 py-1.5 text-sm"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                className="text-muted-foreground flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
              >
                {item.label}
                <span className="text-xs">Coming soon</span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm">{dbUser?.name ?? "Signed in"}</span>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
