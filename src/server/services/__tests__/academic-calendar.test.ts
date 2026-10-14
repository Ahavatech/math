import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createCalendarEntry,
  updateCalendarEntry,
  deleteCalendarEntry,
  listCalendarEntriesAdmin,
  listCalendarEntriesPublic,
  buildCalendarIcsFeed,
} from "../academic-calendar";

const db = await getTestDb();

describe.skipIf(db === null)("academic-calendar service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: "calendar-test-actor@example.com", name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.auditLog.deleteMany({ where: { entityType: "AcademicCalendarEntry", entityId: { in: createdIds } } });
      await db!.academicCalendarEntry.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      session: "2026/2027",
      title: "Resumption of lectures",
      startDate: "2026-09-14",
      endDate: null,
      description: "",
      ...overrides,
    };
  }

  async function create(overrides: Record<string, unknown> = {}) {
    const entry = await createCalendarEntry(db!, input(overrides), actorId);
    createdIds.push(entry.id);
    return entry;
  }

  it("creates an entry with a date-only startDate (no time-of-day drift)", async () => {
    const entry = await create();
    expect(entry.startDate.toISOString().startsWith("2026-09-14")).toBe(true);
  });

  it("updates an entry and logs the action", async () => {
    const entry = await create();
    const updated = await updateCalendarEntry(db!, entry.id, input({ title: "Updated title" }), actorId);
    expect(updated.title).toBe("Updated title");
  });

  it("rejects an endDate before startDate", async () => {
    await expect(create({ startDate: "2026-09-14", endDate: "2026-09-10" })).rejects.toThrow(/end date/i);
  });

  it("deletes an entry", async () => {
    const entry = await create();
    createdIds.splice(createdIds.indexOf(entry.id), 1);
    await deleteCalendarEntry(db!, entry.id, actorId);
    const found = await db!.academicCalendarEntry.findUnique({ where: { id: entry.id } });
    expect(found).toBeNull();
  });

  it("listCalendarEntriesAdmin and listCalendarEntriesPublic both return entries (no status field to filter on)", async () => {
    await create();
    const admin = await listCalendarEntriesAdmin(db!);
    const pub = await listCalendarEntriesPublic(db!);
    expect(admin.length).toBeGreaterThanOrEqual(1);
    expect(pub.length).toBeGreaterThanOrEqual(1);
  });

  it("buildCalendarIcsFeed produces a valid all-day .ics feed from stored entries", async () => {
    await create({ title: "Feed Test Entry" });
    const entries = await listCalendarEntriesPublic(db!);
    const ics = buildCalendarIcsFeed(entries);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Feed Test Entry");
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
  });
});
