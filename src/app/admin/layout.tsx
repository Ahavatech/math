import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "./admin-nav";
import { getCurrentUser, hasPermission, type Permission } from "@/lib/rbac";
import { logoutAction } from "@/server/actions/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

type NavItem = {
  label: string;
  href: string;
  group: string;
  permission: Permission | null;
  implemented: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", group: "Overview", permission: null, implemented: true },
  { label: "Site content", href: "/admin/site", group: "Website", permission: "site.edit", implemented: true },
  { label: "Navigation", href: "/admin/navigation", group: "Website", permission: "site.edit", implemented: true },
  { label: "Pages", href: "/admin/pages", group: "Website", permission: "site.edit", implemented: true },
  { label: "Media", href: "/admin/media", group: "Website", permission: "site.edit", implemented: true },
  { label: "Programmes", href: "/admin/programmes", group: "Academics", permission: "academics.manage", implemented: true },
  { label: "Research", href: "/admin/research", group: "Academics", permission: "academics.manage", implemented: true },
  { label: "Courses", href: "/admin/courses", group: "Academics", permission: "students.manage", implemented: true },
  { label: "Handbook", href: "/admin/handbook", group: "Academics", permission: "students.manage", implemented: true },
  { label: "Calendar", href: "/admin/calendar", group: "Academics", permission: "students.manage", implemented: true },
  { label: "Downloads", href: "/admin/downloads", group: "Academics", permission: "students.manage", implemented: true },
  { label: "Lecturers", href: "/admin/lecturers", group: "People", permission: "lecturers.manage", implemented: true },
  { label: "Staff", href: "/admin/staff", group: "People", permission: "lecturers.manage", implemented: true },
  { label: "Alumni", href: "/admin/alumni", group: "People", permission: "alumni.review", implemented: true },
  { label: "Users", href: "/admin/users", group: "People", permission: "users.manage", implemented: true },
  { label: "News", href: "/admin/news", group: "News and events", permission: "news.manage", implemented: true },
  { label: "Events", href: "/admin/events", group: "News and events", permission: "events.manage", implemented: true },
  { label: "Messages", href: "/admin/messages", group: "News and events", permission: "contact.manage", implemented: true },
  { label: "Manuscripts", href: "/admin/journal/manuscripts", group: "Journal", permission: "journal.editorial", implemented: true },
  { label: "Manuscripts (read)", href: "/admin/journal/manuscripts", group: "Journal", permission: "journal.manuscripts.read", implemented: true },
  { label: "Articles", href: "/admin/journal/articles", group: "Journal", permission: "journal.edit", implemented: true },
  { label: "Issues", href: "/admin/journal/issues", group: "Journal", permission: "journal.edit", implemented: true },
  { label: "Editorial board", href: "/admin/journal/board", group: "Journal", permission: "journal.manage", implemented: true },
  { label: "Journal pages", href: "/admin/journal/pages", group: "Journal", permission: "journal.manage", implemented: true },
  { label: "Journal settings", href: "/admin/journal/settings", group: "Journal", permission: "journal.manage", implemented: true },
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
    { label: "My profile", href: "/admin/my-profile", group: "Account", permission: null, implemented: true },
    { label: "Change password", href: "/admin/my-profile/security", group: "Account", permission: null, implemented: true },
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

  // The same page can be listed under two permissions (Manuscripts); show it once.
  const seen = new Set<string>();
  const navItems = visibleItems
    .filter((item) => item.implemented)
    .filter((item) => (seen.has(item.href) ? false : (seen.add(item.href), true)))
    .map(({ label, href, group }) => ({ label, href, group }));

  return (
    <div className="admin-shell min-h-screen bg-background lg:flex">
      <AdminNav items={navItems} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5 sm:px-6 lg:px-8">
          <span className="min-w-0 truncate">
            <span className="text-sm text-muted-foreground">Signed in as </span>
            <span className="font-medium">{dbUser?.name ?? "you"}</span>
          </span>
          <div className="flex shrink-0 items-center gap-4">
            <Link href="/" className="link-rule hidden py-2 text-[0.9375rem] font-medium sm:inline-block">
              View public site
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="h-10 px-4 text-[0.9375rem]">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="admin-main mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
