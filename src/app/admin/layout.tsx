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
  { label: "Programmes", href: "/admin/programmes", permission: "academics.manage", implemented: true },
  { label: "Research", href: "/admin/research", permission: "academics.manage", implemented: true },
  {
    label: "Lecturers",
    href: "/admin/lecturers",
    permission: "lecturers.manage",
    implemented: true,
  },
  { label: "Staff", href: "/admin/staff", permission: "lecturers.manage", implemented: true },
  { label: "News", href: "/admin/news", permission: "news.manage", implemented: true },
  { label: "Events", href: "/admin/events", permission: "events.manage", implemented: true },
  { label: "Alumni", href: "/admin/alumni", permission: "alumni.review", implemented: true },
  { label: "Handbook", href: "/admin/handbook", permission: "students.manage", implemented: true },
  { label: "Courses", href: "/admin/courses", permission: "students.manage", implemented: true },
  { label: "Downloads", href: "/admin/downloads", permission: "students.manage", implemented: true },
  { label: "Calendar", href: "/admin/calendar", permission: "students.manage", implemented: true },
  { label: "Messages", href: "/admin/messages", permission: "contact.manage", implemented: true },
  { label: "Journal settings", href: "/admin/journal/settings", permission: "journal.manage", implemented: true },
  { label: "Journal pages", href: "/admin/journal/pages", permission: "journal.manage", implemented: true },
  { label: "Editorial board", href: "/admin/journal/board", permission: "journal.manage", implemented: true },
  { label: "Journal issues", href: "/admin/journal/issues", permission: "journal.edit", implemented: true },
  { label: "Journal articles", href: "/admin/journal/articles", permission: "journal.edit", implemented: true },
  { label: "Manuscripts", href: "/admin/journal/manuscripts", permission: "journal.editorial", implemented: true },
  { label: "Manuscripts (read)", href: "/admin/journal/manuscripts", permission: "journal.manuscripts.read", implemented: true },
];

const JOURNAL_PERMISSIONS: Permission[] = ["journal.manage", "journal.edit", "journal.review", "journal.submit"];

/**
 * Every real admin permission except own_profile.edit (which every role,
 * including a bare LECTURER, holds). A user with none of these sees the
 * minimal shell: My profile, Change password, Sign out - every other
 * /admin route still 403s on its own page-level check regardless of
 * what the sidebar shows.
 */
const ADMIN_PERMISSIONS: Permission[] = [
  "users.manage",
  "site.edit",
  "academics.manage",
  "lecturers.manage",
  "news.manage",
  "events.manage",
  "alumni.review",
  "contact.manage",
  "students.manage",
  "journal.manage",
  "journal.edit",
  "journal.editorial",
  "journal.manuscripts.read",
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    redirect("/login");
  }

  const hasAnyJournalPermission = JOURNAL_PERMISSIONS.some((permission) => hasPermission(user, permission));
  const otherThanJournal = ADMIN_PERMISSIONS.filter((p) => !p.startsWith("journal."));
  const hasOtherAdminPermission = otherThanJournal.some((permission) => hasPermission(user, permission));

  const baseMinimalShell: NavItem[] = [
    { label: "My profile", href: "/admin/my-profile", permission: null, implemented: true },
    { label: "Change password", href: "/admin/my-profile/security", permission: null, implemented: true },
  ];

  let visibleItems: NavItem[];
  if (hasOtherAdminPermission) {
    // Full admin shell (may or may not also include the Journal items).
    visibleItems = NAV_ITEMS.filter((item) => item.permission === null || hasPermission(user, item.permission));
  } else if (hasAnyJournalPermission) {
    // Journal-only role (e.g. JOURNAL_EDITOR, JOURNAL_EDITOR_IN_CHIEF
    // without any other admin permission): a minimal shell like the
    // lecturer one, but with the Journal items they can open.
    visibleItems = [
      ...NAV_ITEMS.filter((item) => item.permission?.startsWith("journal.") && hasPermission(user, item.permission)),
      ...baseMinimalShell,
    ];
  } else {
    visibleItems = baseMinimalShell;
  }

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
