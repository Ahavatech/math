import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const [userCount, lecturerCount, pendingAlumniCount, upcomingEventCount] =
    await Promise.all([
      db.user.count(),
      db.lecturerProfile.count(),
      db.alumniEntry.count({ where: { status: "PENDING" } }),
      db.event.count({ where: { startsAt: { gte: new Date() } } }),
    ]);

  const cards = [
    { label: "Users", value: userCount },
    { label: "Lecturers", value: lecturerCount },
    { label: "Pending alumni", value: pendingAlumniCount },
    { label: "Upcoming events", value: upcomingEventCount },
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
