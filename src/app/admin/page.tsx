import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, hasPermission, type Permission } from "@/lib/rbac";
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
  if (!user || !hasDashboardAccess) {
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

  // What is waiting for a person, shown only where this user can act on it.
  const waiting = [
    { label: "alumni entries to approve", value: pendingAlumniCount, href: "/admin/alumni", permission: "alumni.review" as Permission },
    { label: "new contact messages", value: newMessagesCount, href: "/admin/messages", permission: "contact.manage" as Permission },
    { label: "manuscripts awaiting screening", value: awaitingScreeningCount, href: "/admin/journal/manuscripts?status=SUBMITTED", permission: "journal.editorial" as Permission },
    { label: "draft news posts", value: draftNewsCount, href: "/admin/news?status=DRAFT", permission: "news.manage" as Permission },
  ].filter((item) => item.value > 0 && hasPermission(user, item.permission));

  const overview = [
    {
      heading: "People",
      rows: [
        { label: "Users", value: userCount, href: "/admin/users", permission: "users.manage" as Permission },
        { label: "Lecturer profiles", value: lecturerCount, href: "/admin/lecturers", permission: "lecturers.manage" as Permission },
        { label: "Published lecturer profiles", value: publishedLecturerCount, href: "/admin/lecturers", permission: "lecturers.manage" as Permission },
        { label: "Non-teaching staff", value: nonTeachingStaffCount, href: "/admin/staff", permission: "lecturers.manage" as Permission },
      ],
    },
    {
      heading: "Content",
      rows: [
        { label: "Upcoming events", value: upcomingEventCount, href: "/admin/events", permission: "events.manage" as Permission },
        { label: "Published courses", value: courseCount, href: "/admin/courses", permission: "students.manage" as Permission },
        { label: "Handbook pages", value: handbookPageCount, href: "/admin/handbook", permission: "students.manage" as Permission },
      ],
    },
    {
      heading: "Journal",
      rows: [
        { label: "Published issues", value: journalIssueCount, href: "/admin/journal/issues", permission: "journal.edit" as Permission },
        { label: "Published articles", value: journalArticleCount, href: "/admin/journal/articles", permission: "journal.edit" as Permission },
      ],
    },
  ];

  return (
    <div className="space-y-12">
      <h1 className="border-b-2 border-foreground pb-3 font-heading text-3xl font-semibold">Dashboard</h1>

      <section aria-labelledby="waiting-heading">
        <h2 id="waiting-heading" className="font-heading text-xl font-semibold">
          Waiting for you
        </h2>
        {waiting.length > 0 ? (
          <ul className="mt-2 max-w-3xl border-b border-border">
            {waiting.map((item) => (
              <li key={item.href} className="index-row border-t border-border">
                <Link href={item.href} className="flex min-h-14 items-center justify-between gap-4 py-3">
                  <span>
                    <span className="tabular mr-2 font-heading text-2xl font-semibold text-accent">
                      {item.value}
                    </span>
                    {item.label}
                  </span>
                  <ArrowRight className="row-arrow size-4 shrink-0 text-accent" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 max-w-3xl border-y border-border py-4 text-muted-foreground">
            Nothing is waiting for you right now.
          </p>
        )}
      </section>

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="font-heading text-xl font-semibold">
          The site in numbers
        </h2>
        <div className="mt-2 grid gap-x-12 gap-y-8 md:grid-cols-3">
          {overview.map((group) => (
            <div key={group.heading}>
              <h3 className="border-b-2 border-foreground pb-1.5 font-heading text-base font-semibold">
                {group.heading}
              </h3>
              <dl>
                {group.rows.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
                    <dt className="text-muted-foreground">
                      {hasPermission(user, row.permission) ? (
                        <Link href={row.href} className="link-rule py-1">
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                    </dt>
                    <dd className="tabular font-semibold">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
