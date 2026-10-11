import { redirect } from "next/navigation";
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
  "journal.edit",
];

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  const isLecturerOnly = !user || !ADMIN_PERMISSIONS.some((permission) => hasPermission(user, permission));
  if (isLecturerOnly) {
    redirect("/admin/my-profile");
  }

  const [userCount, lecturerCount, publishedLecturerCount, nonTeachingStaffCount, pendingAlumniCount, publishedEvents, draftNewsCount] =
    await Promise.all([
      db.user.count(),
      db.lecturerProfile.count(),
      db.lecturerProfile.count({ where: { status: "PUBLISHED" } }),
      db.nonTeachingStaff.count({ where: { isActive: true } }),
      db.alumniEntry.count({ where: { status: "PENDING" } }),
      db.event.findMany({ where: { status: "PUBLISHED" }, select: { startsAt: true, endsAt: true } }),
      db.newsPost.count({ where: { status: "DRAFT" } }),
    ]);
  const upcomingEventCount = publishedEvents.filter((e) => isUpcoming(e)).length;

  const cards = [
    { label: "Users", value: userCount },
    { label: "Lecturers", value: lecturerCount },
    { label: "Published lecturers", value: publishedLecturerCount },
    { label: "Non-teaching staff", value: nonTeachingStaffCount },
    { label: "Pending alumni", value: pendingAlumniCount },
    { label: "Upcoming events", value: upcomingEventCount },
    { label: "Draft posts", value: draftNewsCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{card.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
