import { afterAll, describe, expect, it } from "vitest";
import { getTestDb } from "./test-db";
import { seed } from "../../../prisma/seed";

const db = await getTestDb();

if (db === null) {
  console.warn(
    "[tests/unit/database/seed.test.ts] skipped: no reachable TEST_DATABASE_URL",
  );
}

describe.skipIf(db === null)("seed", () => {
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("creates the real research areas and programmes from docs/SCOPE.md", async () => {
    await seed(db!);

    const researchAreaCount = await db!.researchArea.count();
    const programmeCount = await db!.programme.count();

    expect(researchAreaCount).toBe(9);
    expect(programmeCount).toBe(3);
  });

  it("creates exactly one SUPER_ADMIN seed user with no password", async () => {
    await seed(db!);

    const admin = await db!.user.findFirst({
      where: { roles: { some: { role: "SUPER_ADMIN" } } },
    });

    expect(admin).not.toBeNull();
    expect(admin?.passwordHash).toBeNull();
    expect(admin?.name.startsWith("[SAMPLE]")).toBe(false);
  });

  it("running twice does not duplicate research areas, programmes, nav items or site settings", async () => {
    await seed(db!);
    const before = {
      researchAreas: await db!.researchArea.count(),
      programmes: await db!.programme.count(),
      navItems: await db!.navItem.count(),
      siteSettings: await db!.siteSetting.count(),
      users: await db!.user.count(),
    };

    await seed(db!);
    const after = {
      researchAreas: await db!.researchArea.count(),
      programmes: await db!.programme.count(),
      navItems: await db!.navItem.count(),
      siteSettings: await db!.siteSetting.count(),
      users: await db!.user.count(),
    };

    expect(after).toEqual(before);
  });
});
