import { describe, expect, it, afterEach, afterAll, beforeEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { bulkCreateLecturers, bulkSendInvites } from "../lecturer-import";

const db = await getTestDb();

const RUN = Date.now().toString(36);

describe.skipIf(db === null)("bulkCreateLecturers", () => {
  const createdUserIds: string[] = [];
  const actorIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length) {
      await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "User", entityId: { in: createdUserIds } } });
      await db!.lecturerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    if (actorIds.length) {
      await db!.auditLog.deleteMany({ where: { actorId: { in: actorIds } } });
      await db!.user.deleteMany({ where: { id: { in: actorIds } } });
    }
    await db?.$disconnect();
  });

  it("creates accounts and DRAFT profiles for every row without sending any email", async () => {
    const actor = await db!.user.create({ data: { email: `import-actor-test-${RUN}@example.com`, name: "Importer" } });
    actorIds.push(actor.id);

    const results = await bulkCreateLecturers(db!, actor.id, [
      { row: 2, fullName: "Bulk One", honorific: "Dr.", rank: "LECTURER_I", email: `bulk-one-test-${RUN}@example.com` },
      { row: 3, fullName: "Bulk Two", honorific: "Prof.", rank: "PROFESSOR", email: `bulk-two-test-${RUN}@example.com` },
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.success).toBe(true);
      if (result.success) createdUserIds.push(result.userId);
    }

    const tokens = await db!.userToken.findMany({ where: { userId: { in: createdUserIds } } });
    expect(tokens).toHaveLength(0);

    const profiles = await db!.lecturerProfile.findMany({ where: { userId: { in: createdUserIds } } });
    expect(profiles.every((p) => p.status === "DRAFT")).toBe(true);
  });

  it("never aborts the whole batch when one row fails", async () => {
    const actor = await db!.user.create({ data: { email: `import-actor-test-2-${RUN}@example.com`, name: "Importer 2" } });
    actorIds.push(actor.id);

    const results = await bulkCreateLecturers(db!, actor.id, [
      { row: 2, fullName: "Good Row", honorific: "", rank: "LECTURER_I", email: `good-row-test-${RUN}@example.com` },
      { row: 3, fullName: "Bad Rank Row", honorific: "", rank: "NOT_A_REAL_RANK" as never, email: `bad-rank-row-test-${RUN}@example.com` },
      { row: 4, fullName: "Another Good Row", honorific: "", rank: "LECTURER_I", email: `another-good-row-test-${RUN}@example.com` },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);

    for (const result of results) {
      if (result.success) createdUserIds.push(result.userId);
    }
  });
});

describe.skipIf(db === null)("bulkSendInvites", () => {
  // Tracked so afterEach can clean up even when the test body throws mid-way.
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    // Pre-emptive cleanup of hardcoded emails in case a prior run crashed before afterEach.
    const stale = await db?.user.findMany({
      where: { email: { in: [`send-invites-actor-${RUN}@example.com`, `send-invites-a-${RUN}@example.com`, `send-invites-b-${RUN}@example.com`] } },
      select: { id: true },
    });
    if (stale?.length) {
      const ids = stale.map((u) => u.id);
      await db!.userToken.deleteMany({ where: { userId: { in: ids } } });
      await db!.auditLog.deleteMany({ where: { actorId: { in: ids } } });
      await db!.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  afterEach(async () => {
    if (createdUserIds.length) {
      await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("sends sequentially, reports per-row results, and never aborts on one failure", async () => {
    const actor = await db!.user.create({ data: { email: `send-invites-actor-${RUN}@example.com`, name: "Actor" } });
    const a = await db!.user.create({ data: { email: `send-invites-a-${RUN}@example.com`, name: "A" } });
    const b = await db!.user.create({ data: { email: `send-invites-b-${RUN}@example.com`, name: "B" } });
    createdUserIds.push(actor.id, a.id, b.id);

    const results = await bulkSendInvites(db!, actor.id, [a.id, b.id, "nonexistent-user-id"]);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(results[2].success).toBe(false);
  });
});
