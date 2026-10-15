import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { EventForm } from "../event-form";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "events.manage")) {
    redirect("/403");
  }

  const [existingMedia, allSeries] = await Promise.all([
    db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    db.eventSeries.findMany({ orderBy: { title: "asc" } }),
  ]);

  return <EventForm event={null} existingMedia={existingMedia} allSeries={allSeries} />;
}
