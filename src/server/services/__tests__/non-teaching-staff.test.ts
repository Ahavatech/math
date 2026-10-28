import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createNonTeachingStaff,
  updateNonTeachingStaff,
  setNonTeachingStaffActive,
  reorderNonTeachingStaff,
  listNonTeachingStaffPublic,
  seedNonTeachingStaff,
} from "../non-teaching-staff";

const db = await getTestDb();

const RUN = Date.now().toString(36);

describe.skipIf(db === null)("non-teaching-staff service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({
      data: { email: `non-teaching-staff-test-actor-${RUN}@example.com`, name: "Staff Test Actor" },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.contentRevision.deleteMany({ where: { entityType: "NonTeachingStaff", entityId: { in: createdIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "NonTeachingStaff", entityId: { in: createdIds } } });
      await db!.nonTeachingStaff.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  async function makeStaff(name: string, overrides: Partial<Parameters<typeof createNonTeachingStaff>[1]> = {}) {
    const created = await createNonTeachingStaff(
      db!,
      { name, position: "Tester", photoId: null, email: "", phone: "", showContact: false, ...overrides },
      actorId,
    );
    createdIds.push(created.id);
    return created;
  }

  it("creates a record, assigning order after the current max", async () => {
    const a = await makeStaff("Order Test A");
    const b = await makeStaff("Order Test B");
    expect(b.order).toBeGreaterThan(a.order);
  });

  it("updates fields and writes a revision", async () => {
    const created = await makeStaff("Update Test");
    const updated = await updateNonTeachingStaff(
      db!,
      created.id,
      { name: "Update Test", position: "New Position", photoId: null, email: "", phone: "", showContact: false },
      actorId,
    );
    expect(updated.position).toBe("New Position");
    const revisions = await db!.contentRevision.findMany({ where: { entityType: "NonTeachingStaff", entityId: created.id } });
    expect(revisions.length).toBeGreaterThan(0);
  });

  it("archives and restores via isActive", async () => {
    const created = await makeStaff("Archive Test");
    const archived = await setNonTeachingStaffActive(db!, created.id, false, actorId);
    expect(archived.isActive).toBe(false);
    const restored = await setNonTeachingStaffActive(db!, created.id, true, actorId);
    expect(restored.isActive).toBe(true);
  });

  it("reorders by swapping with the adjacent sibling, no-op at boundaries", async () => {
    const a = await makeStaff("Reorder A");
    const b = await makeStaff("Reorder B");
    const c = await makeStaff("Reorder C");

    await reorderNonTeachingStaff(db!, b.id, "up");
    const afterUp = await db!.nonTeachingStaff.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, orderBy: { order: "asc" } });
    expect(afterUp.map((s) => s.id)).toEqual([b.id, a.id, c.id]);

    // moving the now-first item up again is a no-op
    await reorderNonTeachingStaff(db!, b.id, "up");
    const stillFirst = await db!.nonTeachingStaff.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, orderBy: { order: "asc" } });
    expect(stillFirst.map((s) => s.id)).toEqual([b.id, a.id, c.id]);

    // moving the last item down is a no-op
    await reorderNonTeachingStaff(db!, c.id, "down");
    const stillLast = await db!.nonTeachingStaff.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, orderBy: { order: "asc" } });
    expect(stillLast.map((s) => s.id)).toEqual([b.id, a.id, c.id]);
  });

  it("only shows contact details publicly when showContact is true", async () => {
    const withContact = await makeStaff("Contact Shown", { email: "shown@example.com", phone: "123", showContact: true });
    const withoutContact = await makeStaff("Contact Hidden", { email: "hidden@example.com", phone: "456", showContact: false });

    const list = await listNonTeachingStaffPublic(db!);
    const shown = list.find((s) => s.id === withContact.id)!;
    const hidden = list.find((s) => s.id === withoutContact.id)!;
    expect(shown.email).toBe("shown@example.com");
    expect(hidden.email).toBeNull();
    expect(hidden.phone).toBeNull();
  });

  it("excludes inactive (archived) staff from the public list", async () => {
    const active = await makeStaff("Public Active");
    const inactive = await makeStaff("Public Inactive");
    await setNonTeachingStaffActive(db!, inactive.id, false, actorId);

    const list = await listNonTeachingStaffPublic(db!);
    expect(list.some((s) => s.id === active.id)).toBe(true);
    expect(list.some((s) => s.id === inactive.id)).toBe(false);
  });

  it("seeds idempotently: running twice does not duplicate or overwrite an edited record", async () => {
    const entries = [{ name: "Seed Test Person", position: "Original Position" }];
    const firstRun = await seedNonTeachingStaff(db!, entries);
    createdIds.push(...firstRun.map((r) => r.id));
    expect(firstRun).toHaveLength(1);

    // Admin edits the seeded record.
    await updateNonTeachingStaff(
      db!,
      firstRun[0].id,
      { name: "Seed Test Person", position: "Admin Edited Position", photoId: null, email: "", phone: "", showContact: false },
      actorId,
    );

    const secondRun = await seedNonTeachingStaff(db!, entries);
    expect(secondRun).toHaveLength(0); // nothing new created, the name already exists

    const row = await db!.nonTeachingStaff.findUniqueOrThrow({ where: { id: firstRun[0].id } });
    expect(row.position).toBe("Admin Edited Position"); // not reverted by the second seed run
  });
});
