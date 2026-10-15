"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { listRevisions, getRevision } from "@/server/services/revisions";
import { watLocalInputToUtc } from "@/lib/time";
import {
  createEvent,
  updateEvent,
  setEventStatus,
  duplicateEvent,
  addGalleryImage,
  removeGalleryImage,
  reorderGalleryImage,
  createEventSeries,
  updateEventSeries,
} from "@/server/services/events";

type ActionResult = { error?: string; success?: boolean; id?: string };

async function requireEventsManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "events.manage");
}

function revalidateEventPaths(slug?: string) {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/events/feed.ics");
  revalidatePath("/");
  if (slug) {
    revalidatePath(`/events/${slug}`);
    revalidatePath(`/events/${slug}/calendar.ics`);
  }
}

const eventFormSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(["SEMINAR", "COLLOQUIUM", "SPECIAL_LECTURE", "CONFERENCE", "GRADUATION", "OTHER"]),
  startsAt: z.string().min(1),
  endsAt: z.string().nullable(),
  venue: z.string().default(""),
  speakerName: z.string().default(""),
  speakerAffiliation: z.string().default(""),
  description: z.string().default(""),
  flyerId: z.string().nullable(),
  registrationUrl: z.string().default(""),
  slidesUrl: z.string().default(""),
  recordingUrl: z.string().default(""),
  seriesId: z.string().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

function parseEventForm(formData: FormData) {
  const endsAtRaw = formData.get("endsAt");
  return eventFormSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    type: formData.get("type"),
    startsAt: formData.get("startsAt"),
    endsAt: endsAtRaw ? String(endsAtRaw) : null,
    venue: formData.get("venue"),
    speakerName: formData.get("speakerName"),
    speakerAffiliation: formData.get("speakerAffiliation"),
    description: formData.get("description"),
    flyerId: formData.get("flyerId") ? String(formData.get("flyerId")) : null,
    registrationUrl: formData.get("registrationUrl"),
    slidesUrl: formData.get("slidesUrl"),
    recordingUrl: formData.get("recordingUrl"),
    seriesId: formData.get("seriesId") ? String(formData.get("seriesId")) : null,
    status: formData.get("status"),
  });
}

function toEventServiceInput(parsed: z.infer<typeof eventFormSchema>) {
  const { description, ...rest } = parsed;
  return {
    ...rest,
    description: sanitizeRichText(description),
    startsAt: watLocalInputToUtc(parsed.startsAt),
    endsAt: parsed.endsAt ? watLocalInputToUtc(parsed.endsAt) : null,
  };
}

export async function createEventAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireEventsManage();
  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const created = await createEvent(db, toEventServiceInput(parsed.data), actor.id, contextFromHeaders(await headers()));
    revalidateEventPaths(created.slug);
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateEventAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireEventsManage();
  const id = String(formData.get("id") ?? "");
  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const updated = await updateEvent(db, id, toEventServiceInput(parsed.data), actor.id, contextFromHeaders(await headers()));
    revalidateEventPaths(updated.slug);
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setEventStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireEventsManage();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") {
    return { error: "Invalid status" };
  }

  try {
    const updated = await setEventStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidateEventPaths(updated.slug);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function duplicateEventAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireEventsManage();
  const id = String(formData.get("id") ?? "");
  try {
    const copy = await duplicateEvent(db, id, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/events");
    return { success: true, id: copy.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not duplicate" };
  }
}

export async function listEventRevisionsAction(id: string) {
  await requireEventsManage();
  const revisions = await listRevisions(db, "Event", id);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
  }));
}

export async function restoreEventAction(formData: FormData): Promise<void> {
  const actor = await requireEventsManage();
  const id = String(formData.get("id") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");

  const revision = await getRevision(db, revisionId);
  if (revision.entityType !== "Event" || revision.entityId !== id) {
    throw new Error("Revision does not belong to this event");
  }

  const snapshot = revision.snapshot as Record<string, unknown>;
  const updated = await updateEvent(
    db,
    id,
    { ...snapshot, startsAt: new Date(snapshot.startsAt as string), endsAt: snapshot.endsAt ? new Date(snapshot.endsAt as string) : null } as never,
    actor.id,
    contextFromHeaders(await headers()),
  );
  revalidateEventPaths(updated.slug);
}

// --- Gallery ---------------------------------------------------------------

export async function addGalleryImageAction(formData: FormData): Promise<ActionResult> {
  await requireEventsManage();
  const eventId = String(formData.get("eventId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  const caption = String(formData.get("caption") ?? "");
  try {
    await addGalleryImage(db, eventId, { mediaId, caption });
    revalidatePath(`/admin/events/${eventId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add image" };
  }
}

export async function removeGalleryImageAction(formData: FormData): Promise<void> {
  await requireEventsManage();
  const id = String(formData.get("id") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  await removeGalleryImage(db, id);
  revalidatePath(`/admin/events/${eventId}`);
}

export async function reorderGalleryImageAction(formData: FormData): Promise<void> {
  await requireEventsManage();
  const id = String(formData.get("id") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const direction = formData.get("direction") === "down" ? "down" : "up";
  await reorderGalleryImage(db, id, direction);
  revalidatePath(`/admin/events/${eventId}`);
}

// --- EventSeries -------------------------------------------------------------

const seriesFormSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
});

export async function createEventSeriesAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireEventsManage();
  const parsed = seriesFormSchema.safeParse({ title: formData.get("title"), description: formData.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const created = await createEventSeries(db, parsed.data, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/events/series");
    return { success: true, id: created.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create" };
  }
}

export async function updateEventSeriesAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireEventsManage();
  const id = String(formData.get("id") ?? "");
  const parsed = seriesFormSchema.safeParse({ title: formData.get("title"), description: formData.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const updated = await updateEventSeries(db, id, parsed.data, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/events/series");
    revalidatePath(`/events/series/${updated.slug}`);
    return { success: true, id: updated.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}
