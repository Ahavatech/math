import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { validateNavHref } from "../navigation";

const db = await getTestDb();

if (db === null) {
  console.warn("[navigation.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

describe("validateNavHref (no database required)", () => {
  it("accepts a known internal route", () => {
    expect(validateNavHref("/about").valid).toBe(true);
    expect(validateNavHref("/programmes").valid).toBe(true);
    expect(validateNavHref("/").valid).toBe(true);
  });

  it("accepts an internal route with a sub-path under a known prefix", () => {
    expect(validateNavHref("/lecturer/jane-doe").valid).toBe(true);
    expect(validateNavHref("/news/some-article").valid).toBe(true);
  });

  it("rejects an unknown internal route", () => {
    expect(validateNavHref("/not-a-real-route").valid).toBe(false);
  });

  it("accepts a well-formed external https URL", () => {
    expect(validateNavHref("https://example.com").valid).toBe(true);
  });

  it("accepts a mailto link", () => {
    expect(validateNavHref("mailto:maths@oauife.edu.ng").valid).toBe(true);
  });

  it("rejects a javascript: URL", () => {
    expect(validateNavHref("javascript:alert(1)").valid).toBe(false);
  });

  it("rejects a relative path with no leading slash", () => {
    expect(validateNavHref("about").valid).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateNavHref("").valid).toBe(false);
  });
});

let createdIds: string[] = [];

describe.skipIf(db === null)("reorderNavItem", () => {
  afterEach(async () => {
    // Children first (FK on parentId), then the parent fixtures.
    await db!.navItem.deleteMany({ where: { parentId: { in: createdIds } } });
    await db!.navItem.deleteMany({ where: { id: { in: createdIds } } });
    createdIds = [];
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  /**
   * reorderNavItem's sibling query matches on (location, parentId), and
   * the shared TEST_DATABASE_URL already carries real seeded top-level
   * nav items (parentId: null) from earlier stages. Nesting every
   * fixture under a freshly created parent keeps the sibling set
   * isolated to exactly what each test creates, regardless of what
   * real data exists at the top level.
   */
  async function makeParent(location: "HEADER" | "FOOTER") {
    const parent = await db!.navItem.create({
      data: { label: "Test parent", href: "/about", location, order: 9999 },
    });
    createdIds.push(parent.id);
    return parent;
  }

  it("moving an item up swaps its order with the previous sibling", async () => {
    const { reorderNavItem } = await import("../navigation");
    const parent = await makeParent("HEADER");

    const a = await db!.navItem.create({
      data: { label: "A", href: "/about", location: "HEADER", order: 0, parentId: parent.id },
    });
    const b = await db!.navItem.create({
      data: { label: "B", href: "/programmes", location: "HEADER", order: 1, parentId: parent.id },
    });

    await reorderNavItem(db!, b.id, "up");

    const [refreshedA, refreshedB] = await Promise.all([
      db!.navItem.findUniqueOrThrow({ where: { id: a.id } }),
      db!.navItem.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(refreshedB.order).toBeLessThan(refreshedA.order);
  });

  it("moving the first item up is a no-op", async () => {
    const { reorderNavItem } = await import("../navigation");
    const parent = await makeParent("HEADER");

    const a = await db!.navItem.create({
      data: { label: "A", href: "/about", location: "HEADER", order: 0, parentId: parent.id },
    });

    await reorderNavItem(db!, a.id, "up");

    const refreshed = await db!.navItem.findUniqueOrThrow({ where: { id: a.id } });
    expect(refreshed.order).toBe(0);
  });

  it("moving an item down swaps its order with the next sibling", async () => {
    const { reorderNavItem } = await import("../navigation");
    const parent = await makeParent("HEADER");

    const a = await db!.navItem.create({
      data: { label: "A", href: "/about", location: "HEADER", order: 0, parentId: parent.id },
    });
    const b = await db!.navItem.create({
      data: { label: "B", href: "/programmes", location: "HEADER", order: 1, parentId: parent.id },
    });

    await reorderNavItem(db!, a.id, "down");

    const [refreshedA, refreshedB] = await Promise.all([
      db!.navItem.findUniqueOrThrow({ where: { id: a.id } }),
      db!.navItem.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect(refreshedA.order).toBeGreaterThan(refreshedB.order);
  });

  it("only swaps within the same location (HEADER items never swap with FOOTER items)", async () => {
    const { reorderNavItem } = await import("../navigation");
    const headerParent = await makeParent("HEADER");
    const footerParent = await makeParent("FOOTER");

    const headerA = await db!.navItem.create({
      data: {
        label: "HA",
        href: "/about",
        location: "HEADER",
        order: 0,
        parentId: headerParent.id,
      },
    });
    await db!.navItem.create({
      data: {
        label: "FA",
        href: "/about",
        location: "FOOTER",
        order: 0,
        parentId: footerParent.id,
      },
    });

    await reorderNavItem(db!, headerA.id, "down");

    const refreshed = await db!.navItem.findUniqueOrThrow({ where: { id: headerA.id } });
    expect(refreshed.order).toBe(0);
  });
});
