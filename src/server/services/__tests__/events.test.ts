import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createEvent,
  updateEvent,
  setEventStatus,
  duplicateEvent,
  getEventByIdAdmin,
  listEventsPublic,
  getPublishedEventBySlug,
  findEventBySlugOrPrevious,
  addGalleryImage,
  removeGalleryImage,
  reorderGalleryImage,
  createEventSeries,
  getEventSeriesBySlugPublic,
} from "../events";

const db = await getTestDb();

const RUN = Date.now().toString(36);

describe.skipIf(db === null)("events service", () => {
  let actorId: string;
  let photoId: string;
  const createdEventIds: string[] = [];
  const createdSeriesIds: string[] = [];
  const createdMediaIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: `events-test-actor-${RUN}@example.com`, name: "Actor" } });
    actorId = actor.id;
    const media = await db!.mediaAsset.create({
      data: { provider: "cloudinary", publicId: "events-test-photo", url: "https://example.com/p.jpg", alt: "alt" },
    });
    photoId = media.id;
    createdMediaIds.push(media.id);
  });

  afterAll(async () => {
    await db!.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdEventIds.length) {
      await db!.eventGalleryImage.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await db!.contentRevision.deleteMany({ where: { entityType: "Event", entityId: { in: createdEventIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "Event", entityId: { in: createdEventIds } } });
      await db!.event.deleteMany({ where: { id: { in: createdEventIds } } });
      createdEventIds.length = 0;
    }
    if (createdSeriesIds.length) {
      await db!.eventSeries.deleteMany({ where: { id: { in: createdSeriesIds } } });
      createdSeriesIds.length = 0;
    }
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      title: "Test Seminar",
      type: "SEMINAR" as const,
      startsAt: new Date("2030-07-08T10:00:00.000Z"),
      endsAt: new Date("2030-07-08T12:00:00.000Z"),
      venue: "Seminar room",
      speakerName: "",
      speakerAffiliation: "",
      description: "",
      flyerId: null,
      registrationUrl: "",
      slidesUrl: "",
      recordingUrl: "",
      seriesId: null,
      status: "DRAFT" as const,
      ...overrides,
    };
  }

  it("creates an event with a generated unique slug", async () => {
    const created = await createEvent(db!, input(), actorId);
    createdEventIds.push(created.id);
    expect(created.slug).toBe("test-seminar");
  });

  it("changing the slug on update pushes the old one into previousSlugs", async () => {
    const created = await createEvent(db!, input(), actorId);
    createdEventIds.push(created.id);
    const updated = await updateEvent(db!, created.id, { ...input(), slug: "renamed-seminar" }, actorId);
    expect(updated.previousSlugs).toContain("test-seminar");
  });

  it("archives and restores via setEventStatus", async () => {
    const created = await createEvent(db!, input(), actorId);
    createdEventIds.push(created.id);
    const archived = await setEventStatus(db!, created.id, "ARCHIVED", actorId);
    expect(archived.status).toBe("ARCHIVED");
    const restored = await setEventStatus(db!, created.id, "DRAFT", actorId);
    expect(restored.status).toBe("DRAFT");
  });

  it("duplicateEvent copies fields but not dates, gallery, slides, recording or status", async () => {
    const original = await createEvent(
      db!,
      input({ status: "PUBLISHED", slidesUrl: "https://example.com/slides", recordingUrl: "https://example.com/rec", speakerName: "Dr. X" }),
      actorId,
    );
    createdEventIds.push(original.id);
    await addGalleryImage(db!, original.id, { mediaId: photoId, caption: "A caption" });

    const copy = await duplicateEvent(db!, original.id, actorId);
    createdEventIds.push(copy.id);

    expect(copy.status).toBe("DRAFT");
    expect(copy.title).toBe(original.title);
    expect(copy.speakerName).toBe("Dr. X");
    expect(copy.slidesUrl).toBe("");
    expect(copy.recordingUrl).toBe("");
    expect(copy.slug).not.toBe(original.slug);
    expect(copy.startsAt.getTime()).not.toBe(original.startsAt.getTime());
    expect(copy.endsAt).toBeNull();

    const copyGallery = await db!.eventGalleryImage.findMany({ where: { eventId: copy.id } });
    expect(copyGallery).toHaveLength(0);
  });

  it("gallery: adds, reorders, removes, and enforces a 30-image cap", async () => {
    const event = await createEvent(db!, input(), actorId);
    createdEventIds.push(event.id);

    const a = await addGalleryImage(db!, event.id, { mediaId: photoId, caption: "A" });
    const b = await addGalleryImage(db!, event.id, { mediaId: photoId, caption: "B" });
    expect(b.order).toBeGreaterThan(a.order);

    await reorderGalleryImage(db!, b.id, "up");
    const afterReorder = await db!.eventGalleryImage.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } });
    expect(afterReorder.map((g) => g.id)).toEqual([b.id, a.id]);

    await removeGalleryImage(db!, a.id);
    const afterRemove = await db!.eventGalleryImage.findMany({ where: { eventId: event.id } });
    expect(afterRemove).toHaveLength(1);
  });

  it("gallery: rejects adding a 31st image", async () => {
    const event = await createEvent(db!, input(), actorId);
    createdEventIds.push(event.id);
    for (let i = 0; i < 30; i++) {
      await addGalleryImage(db!, event.id, { mediaId: photoId, caption: `Image ${i}` });
    }
    await expect(addGalleryImage(db!, event.id, { mediaId: photoId, caption: "One too many" })).rejects.toThrow();
  });

  it("public query excludes DRAFT and ARCHIVED events", async () => {
    const draft = await createEvent(db!, input({ title: "Public Draft Event Test" }), actorId);
    const published = await createEvent(db!, input({ title: "Public Published Event Test", status: "PUBLISHED" }), actorId);
    createdEventIds.push(draft.id, published.id);

    const { events } = await listEventsPublic(db!, { tab: "upcoming", page: 1, perPage: 20 });
    const slugs = events.map((e) => e.slug);
    expect(slugs).toContain(published.slug);
    expect(slugs).not.toContain(draft.slug);
  });

  it("upcoming/past tabs split correctly using isUpcoming semantics", async () => {
    const future = await createEvent(
      db!,
      input({ title: "Future Event Test", status: "PUBLISHED", startsAt: new Date(Date.now() + 86_400_000), endsAt: new Date(Date.now() + 90_000_000) }),
      actorId,
    );
    const past = await createEvent(
      db!,
      input({ title: "Past Event Test", status: "PUBLISHED", startsAt: new Date(Date.now() - 90_000_000), endsAt: new Date(Date.now() - 86_400_000) }),
      actorId,
    );
    createdEventIds.push(future.id, past.id);

    const upcoming = await listEventsPublic(db!, { tab: "upcoming", page: 1, perPage: 20 });
    expect(upcoming.events.map((e) => e.id)).toContain(future.id);
    expect(upcoming.events.map((e) => e.id)).not.toContain(past.id);

    const pastTab = await listEventsPublic(db!, { tab: "past", page: 1, perPage: 20 });
    expect(pastTab.events.map((e) => e.id)).toContain(past.id);
    expect(pastTab.events.map((e) => e.id)).not.toContain(future.id);
  });

  it("findEventBySlugOrPrevious redirects via previousSlugs", async () => {
    const created = await createEvent(db!, input({ status: "PUBLISHED" }), actorId);
    createdEventIds.push(created.id);
    const updated = await updateEvent(db!, created.id, { ...input({ status: "PUBLISHED" }), slug: "renamed-slug-2" }, actorId);

    const viaOld = await findEventBySlugOrPrevious(db!, updated.previousSlugs[0]);
    expect(viaOld?.redirectTo).toBe("renamed-slug-2");
  });

  it("EventSeries: create and read its public page with linked events", async () => {
    const series = await createEventSeries(db!, { title: "Test Series", description: "A series" }, actorId);
    createdSeriesIds.push(series.id);

    const linked = await createEvent(db!, input({ title: "Series Event Test", status: "PUBLISHED", seriesId: series.id }), actorId);
    createdEventIds.push(linked.id);

    const found = await getEventSeriesBySlugPublic(db!, series.slug);
    expect(found?.events.map((e) => e.id)).toContain(linked.id);
  });

  it("getPublishedEventBySlug returns null for a draft", async () => {
    const draft = await createEvent(db!, input({ title: "Draft Lookup Test" }), actorId);
    createdEventIds.push(draft.id);
    expect(await getPublishedEventBySlug(db!, draft.slug)).toBeNull();
  });

  it("getEventByIdAdmin returns drafts too", async () => {
    const draft = await createEvent(db!, input({ title: "Admin Lookup Test" }), actorId);
    createdEventIds.push(draft.id);
    expect((await getEventByIdAdmin(db!, draft.id)).id).toBe(draft.id);
  });
});
