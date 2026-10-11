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

  it("gives a newly-added NavItem an order after the current maximum for its location, never colliding with an existing item", async () => {
    await seed(db!);

    // Reproduce the real bug this guards against: a database that was
    // already seeded, then a later code change adds a brand new
    // NAV_ITEMS entry (simulated here by removing "Staff" from FOOTER
    // and dropping a "probe" item into its old order slot, standing in
    // for an item that already occupies that order value).
    const staffFooterItem = await db!.navItem.findFirstOrThrow({ where: { href: "/staff", location: "FOOTER" } });
    const staffOrder = staffFooterItem.order;
    await db!.navItem.delete({ where: { id: staffFooterItem.id } });

    const probeHref = "/__seed_order_probe__";
    await db!.navItem.create({
      data: { label: "Probe", href: probeHref, location: "FOOTER", order: staffOrder },
    });

    // Re-seeding must recreate the missing "Staff" item without colliding
    // with the probe's order value (this is the exact scenario the old
    // code got wrong: it used the NAV_ITEMS array's own hardcoded order
    // number instead of checking what the database already had).
    await seed(db!);

    const recreatedStaff = await db!.navItem.findFirstOrThrow({ where: { href: "/staff", location: "FOOTER" } });
    const probe = await db!.navItem.findFirstOrThrow({ where: { href: probeHref } });
    expect(recreatedStaff.order).not.toBe(probe.order);
    expect(recreatedStaff.order).toBeGreaterThan(probe.order);

    await db!.navItem.deleteMany({ where: { href: probeHref } });
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

  it("seeds the real news post and events from the live site, idempotently and never overwriting an admin edit", async () => {
    await seed(db!);

    const post = await db!.newsPost.findFirstOrThrow({ where: { title: "Emerging Economy seminar holds on 8 July 2026" } });
    expect(post.status).toBe("PUBLISHED");
    expect(post.category).toBe("ANNOUNCEMENT");

    const seminar = await db!.event.findFirstOrThrow({ where: { title: "Emerging Economy Seminar" } });
    expect(seminar.speakerName).toBe("Banji Osatumberu");
    const lecture = await db!.event.findFirstOrThrow({
      where: { title: "A Special Undergraduate Lecture on Optimization Methods in Machine Learning" },
    });
    expect(lecture.speakerName).toBe("Adebanji Adelowo");

    // Admin edits the seeded post.
    await db!.newsPost.update({ where: { id: post.id }, data: { title: "HOD-edited title, must survive re-seed" } });

    try {
      await seed(db!);

      const newsCount = await db!.newsPost.count({ where: { title: { contains: "Emerging Economy seminar holds" } } });
      expect(newsCount).toBe(0); // the original title is gone (renamed), and no duplicate was created
      const stillEdited = await db!.newsPost.findUniqueOrThrow({ where: { id: post.id } });
      expect(stillEdited.title).toBe("HOD-edited title, must survive re-seed");

      const eventCount = await db!.event.count({ where: { title: { in: ["Emerging Economy Seminar", "A Special Undergraduate Lecture on Optimization Methods in Machine Learning"] } } });
      expect(eventCount).toBe(2); // no duplicates from the second seed run
    } finally {
      // Revert so this shared test database is left exactly as other
      // runs of this test (and the rest of the suite) expect it.
      await db!.newsPost.update({ where: { id: post.id }, data: { title: "Emerging Economy seminar holds on 8 July 2026" } });
    }
  });
});
