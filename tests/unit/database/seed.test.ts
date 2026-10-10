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

  it("fills real content into research areas and programmes that are still at the placeholder", async () => {
    await seed(db!);

    const area = await db!.researchArea.findUniqueOrThrow({ where: { slug: "algebra-and-number-theory" } });
    expect(area.summary).not.toBe("Placeholder description. The department will provide final copy for this page.");
    expect(area.summary.length).toBeGreaterThan(0);

    const programme = await db!.programme.findUniqueOrThrow({ where: { slug: "bsc-mathematics" } });
    expect(programme.summary).not.toBe("Placeholder description. The department will provide final copy for this page.");

    const msc = await db!.programme.findUniqueOrThrow({
      where: { slug: "msc-mathematics" },
      include: { specialisations: true },
    });
    expect(msc.specialisations.length).toBe(10);
  });

  it("never overwrites a research area field an admin has already edited, even on re-seed", async () => {
    await seed(db!);
    await db!.researchArea.update({
      where: { slug: "analysis" },
      data: { summary: "HOD-edited summary, must survive re-seed" },
    });

    await seed(db!);

    const area = await db!.researchArea.findUniqueOrThrow({ where: { slug: "analysis" } });
    expect(area.summary).toBe("HOD-edited summary, must survive re-seed");
  });

  it("never overwrites a programme field an admin has already edited, even on re-seed", async () => {
    await seed(db!);
    await db!.programme.update({
      where: { slug: "phd-mathematics" },
      data: { summary: "HOD-edited programme summary, must survive re-seed" },
    });

    await seed(db!);

    const programme = await db!.programme.findUniqueOrThrow({ where: { slug: "phd-mathematics" } });
    expect(programme.summary).toBe("HOD-edited programme summary, must survive re-seed");
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
