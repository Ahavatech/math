import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";

const db = await getTestDb();

if (db === null) {
  console.warn("[stats.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

let createdUserIds: string[] = [];
let createdLecturerIds: string[] = [];

describe.skipIf(db === null)("homepage stats", () => {
  afterEach(async () => {
    await db!.lecturerProfile.deleteMany({ where: { id: { in: createdLecturerIds } } });
    await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await db!.siteSetting.deleteMany({ where: { key: "homepage.stats" } });
    await db!.contentRevision.deleteMany({ where: { entityId: "homepage.stats" } });
    createdUserIds = [];
    createdLecturerIds = [];
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("computes staff automatically as published, non-emeritus lecturer profiles", async () => {
    const { getHomepageStats } = await import("../stats");

    const user1 = await db!.user.create({ data: { email: "stats-l1@example.com", name: "L1" } });
    const user2 = await db!.user.create({ data: { email: "stats-l2@example.com", name: "L2" } });
    const user3 = await db!.user.create({ data: { email: "stats-l3@example.com", name: "L3" } });
    createdUserIds.push(user1.id, user2.id, user3.id);

    const l1 = await db!.lecturerProfile.create({
      data: { userId: user1.id, slug: "l1", fullName: "L1", rank: "LECTURER_I", status: "PUBLISHED" },
    });
    const l2 = await db!.lecturerProfile.create({
      data: {
        userId: user2.id,
        slug: "l2",
        fullName: "L2",
        rank: "PROFESSOR",
        status: "PUBLISHED",
        isEmeritus: true,
      },
    });
    const l3 = await db!.lecturerProfile.create({
      data: { userId: user3.id, slug: "l3", fullName: "L3", rank: "LECTURER_I", status: "DRAFT" },
    });
    createdLecturerIds.push(l1.id, l2.id, l3.id);

    const stats = await getHomepageStats(db!);
    expect(stats.staff.mode).toBe("auto");
    expect(stats.staff.value).toBe(1);
  });

  it("uses the manual override value and reports mode: manual when set", async () => {
    const { getHomepageStats } = await import("../stats");
    const { setSetting } = await import("../site-settings");

    await setSetting(
      db!,
      "homepage.stats",
      {
        staff: { mode: "manual", manualValue: 42 },
        alumni: { mode: "auto", manualValue: null },
        programmes: { mode: "auto", manualValue: null },
        researchAreas: { mode: "auto", manualValue: null },
      },
      null,
    );

    const stats = await getHomepageStats(db!);
    expect(stats.staff.mode).toBe("manual");
    expect(stats.staff.value).toBe(42);
  });

  it("falls back to auto computation if manual mode has no manualValue set", async () => {
    const { getHomepageStats } = await import("../stats");
    const { setSetting } = await import("../site-settings");

    await setSetting(
      db!,
      "homepage.stats",
      {
        staff: { mode: "manual", manualValue: null },
        alumni: { mode: "auto", manualValue: null },
        programmes: { mode: "auto", manualValue: null },
        researchAreas: { mode: "auto", manualValue: null },
      },
      null,
    );

    const stats = await getHomepageStats(db!);
    // mode is still reported as what was configured, but the value
    // must never be null on the page - falls back to the real count.
    expect(stats.staff.value).toBe(0);
  });
});
