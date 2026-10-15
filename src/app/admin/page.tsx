import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission, type Permission } from "@/lib/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { isUpcoming } from "@/lib/time";

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
];

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  // Journal-only roles (journal.manage/journal.edit with nothing else)
  // have no dashboard content here - same minimal-shell treatment as a
  // bare LECTURER, redirected to their own profile instead.
  const hasDashboardAccess = !!user && ADMIN_PERMISSIONS.some((permission) => hasPermission(user, permission));
  if (!hasDashboardAccess) {
    redirect("/admin/my-profile");
  }

  const [
    userCount,
    lecturerCount,
    publishedLecturerCount,
    nonTeachingStaffCount,
    pendingAlumniCount,
    publishedEvents,
    draftNewsCount,
    newMessagesCount,
    courseCount,
    handbookPageCount,
    journalIssueCount,
    journalArticleCount,
    awaitingScreeningCount,
  ] = await Promise.all([
    db.user.count(),
    db.lecturerProfile.count(),
    db.lecturerProfile.count({ where: { status: "PUBLISHED" } }),
    db.nonTeachingStaff.count({ where: { isActive: true } }),
    db.alumniEntry.count({ where: { status: "PENDING" } }),
    db.event.findMany({ where: { status: "PUBLISHED" }, select: { startsAt: true, endsAt: true } }),
    db.newsPost.count({ where: { status: "DRAFT" } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.handbookPage.count({ where: { status: "PUBLISHED" } }),
    db.journalIssue.count({ where: { status: "PUBLISHED" } }),
    db.article.count({ where: { status: "PUBLISHED" } }),
    db.manuscript.count({ where: { status: "SUBMITTED" } }),
  ]);
  const upcomingEventCount = publishedEvents.filter((e) => isUpcoming(e)).length;

  const cards = [
    { label: "Users", value: userCount, href: null },
    { label: "Lecturers", value: lecturerCount, href: null },
    { label: "Published lecturers", value: publishedLecturerCount, href: null },
    { label: "Non-teaching staff", value: nonTeachingStaffCount, href: null },
    { label: "Pending alumni", value: pendingAlumniCount, href: "/admin/alumni" },
    { label: "Upcoming events", value: upcomingEventCount, href: null },
    { label: "Draft posts", value: draftNewsCount, href: null },
    { label: "New messages", value: newMessagesCount, href: "/admin/messages" },
    { label: "Courses", value: courseCount, href: null },
    { label: "Handbook pages", value: handbookPageCount, href: null },
    { label: "Journal issues", value: journalIssueCount, href: null },
    { label: "Journal articles", value: journalArticleCount, href: null },
    { label: "Awaiting screening", value: awaitingScreeningCount, href: "/admin/journal/manuscripts?status=SUBMITTED" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => {
        const content = (
          <Card key={card.label} className={card.href ? "transition-colors hover:border-primary" : undefined}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{card.value}</CardContent>
          </Card>
        );
        return card.href ? (
          <Link key={card.label} href={card.href}>
            {content}
          </Link>
        ) : (
          content
        );
      })}
    </div>
  );
}
