import "server-only";
import type { ContentStatus, PrismaClient } from "@prisma/client";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";
import { generateUniqueSlug } from "@/lib/slugify";
import { isUpcoming } from "@/lib/time";
import { eventInputSchema, eventSeriesInputSchema, galleryImageInputSchema } from "@/lib/validators/event";
import { getSetting, setSetting } from "./site-settings";

/** Saving a seeded event IS the HOD review it was flagged for. */
async function clearEventImportFlag(db: PrismaClient, id: string, actorId: string) {
  const flags = await getSetting(db, "events.importFlags");
  if (flags[id]) {
    const { [id]: _removed, ...rest } = flags;
    await setSetting(db, "events.importFlags", rest, actorId);
  }
}

export const MAX_GALLERY_IMAGES = 30;

export async function listEventsAdmin(db: PrismaClient) {
  return db.event.findMany({ orderBy: { startsAt: "desc" }, include: { flyer: true, series: true } });
}

export async function getEventByIdAdmin(db: PrismaClient, id: string) {
  return db.event.findUniqueOrThrow({
    where: { id },
    include: { flyer: true, series: true, galleryImages: { include: { media: true }, orderBy: { order: "asc" } } },
  });
}

export async function createEvent(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = eventInputSchema.parse(input);
  const slug = await generateUniqueSlug(parsed.title, async (candidate) => {
    const existing = await db.event.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  return db.$transaction(async (tx) => {
    const created = await tx.event.create({ data: { ...parsed, slug } });
    await createRevision(tx, { entityType: "Event", entityId: created.id, snapshot: { ...parsed, slug }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "event.create", entityType: "Event", entityId: created.id, summary: `Created ${created.title}` },
      context,
    );
    return created;
  });
}

export async function updateEvent(
  db: PrismaClient,
  id: string,
  input: Record<string, unknown> & { slug: string },
  actorId: string,
  context?: AuditRequestContext,
) {
  const { slug: nextSlug, ...rest } = input as { slug: string } & Record<string, unknown>;
  const parsed = eventInputSchema.parse(rest);
  const existing = await db.event.findUniqueOrThrow({ where: { id } });

  const previousSlugs =
    nextSlug !== existing.slug
      ? Array.from(new Set([...existing.previousSlugs, existing.slug]))
      : existing.previousSlugs;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.event.update({ where: { id }, data: { ...parsed, slug: nextSlug, previousSlugs } });
    await createRevision(tx, { entityType: "Event", entityId: id, snapshot: { ...parsed, slug: nextSlug }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "event.update", entityType: "Event", entityId: id, summary: `Updated ${result.title}` },
      context,
    );
    return result;
  });
  await clearEventImportFlag(db, id, actorId);
  return updated;
}

export async function setEventStatus(
  db: PrismaClient,
  id: string,
  status: ContentStatus,
  actorId: string,
  context?: AuditRequestContext,
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.event.update({ where: { id }, data: { status } });
    await logAction(
      tx,
      { actorId, action: "event.set_status", entityType: "Event", entityId: id, summary: `Set ${updated.title} to ${status}` },
      context,
    );
    return updated;
  });
}

/** Copies everything except dates, gallery, slides, recording and status - the copy always starts DRAFT. */
export async function duplicateEvent(db: PrismaClient, id: string, actorId: string, context?: AuditRequestContext) {
  const original = await db.event.findUniqueOrThrow({ where: { id } });
  const slug = await generateUniqueSlug(`${original.title} copy`, async (candidate) => {
    const existing = await db.event.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  return db.$transaction(async (tx) => {
    const copy = await tx.event.create({
      data: {
        slug,
        title: original.title,
        type: original.type,
        // Dates are deliberately not copied (the spec: "copies
        // everything except dates ... the copy starts DRAFT"). startsAt
        // is a required column, so it defaults to the moment of
        // duplication as an obvious placeholder the admin must change
        // before publishing, rather than silently reusing the
        // original's (now almost certainly wrong) date.
        startsAt: new Date(),
        endsAt: null,
        venue: original.venue,
        speakerName: original.speakerName,
        speakerAffiliation: original.speakerAffiliation,
        description: original.description,
        flyerId: original.flyerId,
        registrationUrl: "",
        slidesUrl: "",
        recordingUrl: "",
        seriesId: original.seriesId,
        status: "DRAFT",
      },
    });
    await logAction(
      tx,
      { actorId, action: "event.duplicate", entityType: "Event", entityId: copy.id, summary: `Duplicated from ${original.title}` },
      context,
    );
    return copy;
  });
}

// --- Gallery -------------------------------------------------------------

export async function addGalleryImage(db: PrismaClient, eventId: string, input: unknown) {
  const parsed = galleryImageInputSchema.parse(input);
  const count = await db.eventGalleryImage.count({ where: { eventId } });
  if (count >= MAX_GALLERY_IMAGES) {
    throw new Error(`An event can have at most ${MAX_GALLERY_IMAGES} gallery images`);
  }
  const max = await db.eventGalleryImage.aggregate({ where: { eventId }, _max: { order: true } });
  return db.eventGalleryImage.create({
    data: { eventId, mediaId: parsed.mediaId, caption: parsed.caption, order: (max._max.order ?? -1) + 1 },
  });
}

export async function removeGalleryImage(db: PrismaClient, id: string) {
  await db.eventGalleryImage.delete({ where: { id } });
}

export async function reorderGalleryImage(db: PrismaClient, id: string, direction: "up" | "down") {
  const target = await db.eventGalleryImage.findUniqueOrThrow({ where: { id } });
  const siblings = await db.eventGalleryImage.findMany({ where: { eventId: target.eventId }, orderBy: { order: "asc" } });

  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.eventGalleryImage.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.eventGalleryImage.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}

// --- EventSeries -----------------------------------------------------------

export async function listEventSeriesAdmin(db: PrismaClient) {
  return db.eventSeries.findMany({ orderBy: { title: "asc" }, include: { _count: { select: { events: true } } } });
}

export async function createEventSeries(db: PrismaClient, input: unknown, actorId: string, context?: AuditRequestContext) {
  const parsed = eventSeriesInputSchema.parse(input);
  const slug = await generateUniqueSlug(parsed.title, async (candidate) => {
    const existing = await db.eventSeries.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });
  const created = await db.eventSeries.create({ data: { ...parsed, slug } });
  await logAction(
    db,
    { actorId, action: "event_series.create", entityType: "EventSeries", entityId: created.id, summary: `Created ${created.title}` },
    context,
  );
  return created;
}

export async function updateEventSeries(db: PrismaClient, id: string, input: unknown, actorId: string, context?: AuditRequestContext) {
  const parsed = eventSeriesInputSchema.parse(input);
  const updated = await db.eventSeries.update({ where: { id }, data: parsed });
  await logAction(
    db,
    { actorId, action: "event_series.update", entityType: "EventSeries", entityId: id, summary: `Updated ${updated.title}` },
    context,
  );
  return updated;
}

export async function getEventSeriesBySlugPublic(db: PrismaClient, slug: string) {
  try {
    const series = await db.eventSeries.findUnique({
      where: { slug },
      include: {
        events: {
          where: { status: "PUBLISHED" },
          orderBy: { startsAt: "desc" },
          select: { id: true, slug: true, title: true, type: true, startsAt: true, endsAt: true, venue: true },
        },
      },
    });
    return series;
  } catch {
    return null;
  }
}

// --- Public ----------------------------------------------------------------

const PUBLIC_EVENT_SELECT = {
  id: true,
  slug: true,
  title: true,
  type: true,
  startsAt: true,
  endsAt: true,
  venue: true,
  speakerName: true,
  speakerAffiliation: true,
  description: true,
  flyer: { select: { id: true, url: true, alt: true } },
  registrationUrl: true,
  slidesUrl: true,
  recordingUrl: true,
  series: { select: { id: true, slug: true, title: true } },
} as const;

export async function listEventsPublic(
  db: PrismaClient,
  options: { tab: "upcoming" | "past"; page: number; perPage: number; type?: string; year?: number },
) {
  try {
    const where = {
      status: "PUBLISHED" as const,
      ...(options.type ? { type: options.type as never } : {}),
      ...(options.year
        ? { startsAt: { gte: new Date(Date.UTC(options.year, 0, 1)), lt: new Date(Date.UTC(options.year + 1, 0, 1)) } }
        : {}),
    };
    const all = await db.event.findMany({ where, select: PUBLIC_EVENT_SELECT });
    const now = new Date();
    const filtered = all.filter((e) => (options.tab === "upcoming" ? isUpcoming(e, now) : !isUpcoming(e, now)));
    filtered.sort((a, b) => (options.tab === "upcoming" ? a.startsAt.getTime() - b.startsAt.getTime() : b.startsAt.getTime() - a.startsAt.getTime()));

    const total = filtered.length;
    const start = (options.page - 1) * options.perPage;
    const events = filtered.slice(start, start + options.perPage);
    return { events, total };
  } catch {
    return { events: [], total: 0 };
  }
}

export async function listUpcomingEventsPublic(db: PrismaClient, limit: number) {
  try {
    const all = await db.event.findMany({ where: { status: "PUBLISHED" }, select: PUBLIC_EVENT_SELECT });
    const now = new Date();
    return all
      .filter((e) => isUpcoming(e, now))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function getPublishedEventBySlug(db: PrismaClient, slug: string) {
  try {
    const event = await db.event.findUnique({
      where: { slug },
      select: {
        ...PUBLIC_EVENT_SELECT,
        status: true,
        galleryImages: { orderBy: { order: "asc" }, select: { id: true, caption: true, media: { select: { id: true, url: true, alt: true } } } },
      },
    });
    if (!event || event.status !== "PUBLISHED") return null;
    const { status: _status, ...publicFields } = event;
    return publicFields;
  } catch {
    return null;
  }
}

/** Looks up a slug regardless of status, for the previousSlugs redirect. */
export async function findEventBySlugOrPrevious(db: PrismaClient, slug: string) {
  try {
    const direct = await db.event.findUnique({ where: { slug }, select: { slug: true, status: true } });
    if (direct) return { event: direct, redirectTo: null as string | null };

    const viaPrevious = await db.event.findFirst({
      where: { previousSlugs: { has: slug } },
      select: { slug: true, status: true },
    });
    if (viaPrevious) return { event: viaPrevious, redirectTo: viaPrevious.slug };

    return null;
  } catch {
    return null;
  }
}

/** For the ICS feed: all published, currently-upcoming events. */
export async function listUpcomingEventsForIcsFeed(db: PrismaClient) {
  try {
    const all = await db.event.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, slug: true, title: true, description: true, venue: true, startsAt: true, endsAt: true },
    });
    const now = new Date();
    return all.filter((e) => isUpcoming(e, now)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  } catch {
    return [];
  }
}
