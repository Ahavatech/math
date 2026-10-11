import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getEventByIdAdmin } from "@/server/services/events";
import { EventForm } from "../event-form";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "events.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  let event;
  try {
    event = await getEventByIdAdmin(db, id);
  } catch {
    notFound();
  }

  const [existingMedia, allSeries] = await Promise.all([
    db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    db.eventSeries.findMany({ orderBy: { title: "asc" } }),
  ]);

  return <EventForm event={event} existingMedia={existingMedia} allSeries={allSeries} />;
}
