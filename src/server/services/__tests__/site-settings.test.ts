import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";

const db = await getTestDb();

if (db === null) {
  console.warn("[site-settings.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

describe.skipIf(db === null)("site settings registry", () => {
  afterEach(async () => {
    await db!.contentRevision.deleteMany({ where: { entityType: "SiteSetting" } });
    await db!.siteSetting.deleteMany({
      where: { key: { in: ["identity", "homepage.hero", "site.announcement"] } },
    });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("returns the default value for a key with no row yet", async () => {
    const { getSetting } = await import("../site-settings");
    const value = await getSetting(db!, "identity");
    expect(value).toEqual(
      expect.objectContaining({ name: expect.any(String), tagline: expect.any(String) }),
    );
  });

  it("rejects an unknown key at the type level and at runtime", async () => {
    const { setSetting } = await import("../site-settings");
    await expect(
      // @ts-expect-error -- intentionally an unregistered key
      setSetting(db!, "not.a.real.key", {}, null),
    ).rejects.toThrow(/unknown settings key/i);
  });

  it("rejects a value that fails the key's schema", async () => {
    const { setSetting } = await import("../site-settings");
    await expect(
      setSetting(db!, "identity", { name: "", tagline: "x", logoId: null }, null),
    ).rejects.toThrow();
  });

  it("saves a valid value, round-trips through getSetting, and writes a ContentRevision + AuditLog", async () => {
    const { setSetting, getSetting } = await import("../site-settings");
    const actor = await db!.user.create({
      data: { email: "settings-actor@example.com", name: "Actor" },
    });

    await setSetting(
      db!,
      "identity",
      { name: "Department of Mathematics", tagline: "For learning and culture", logoId: null },
      actor.id,
    );

    const value = await getSetting(db!, "identity");
    expect(value.name).toBe("Department of Mathematics");

    const revisions = await db!.contentRevision.findMany({
      where: { entityType: "SiteSetting", entityId: "identity" },
    });
    expect(revisions).toHaveLength(1);

    const logs = await db!.auditLog.findMany({
      where: { entityType: "SiteSetting", entityId: "identity", actorId: actor.id },
    });
    expect(logs.length).toBeGreaterThan(0);

    await db!.userRole.deleteMany({ where: { userId: actor.id } });
    await db!.auditLog.deleteMany({ where: { actorId: actor.id } });
    await db!.user.delete({ where: { id: actor.id } });
  });

  it("a second save creates a second revision, so version history has something to restore to", async () => {
    const { setSetting } = await import("../site-settings");

    await setSetting(
      db!,
      "site.announcement",
      { enabled: true, message: "First message", href: null },
      null,
    );
    await setSetting(
      db!,
      "site.announcement",
      { enabled: true, message: "Second message", href: null },
      null,
    );

    const revisions = await db!.contentRevision.findMany({
      where: { entityType: "SiteSetting", entityId: "site.announcement" },
      orderBy: { createdAt: "asc" },
    });
    expect(revisions).toHaveLength(2);
    expect((revisions[0].snapshot as { message: string }).message).toBe("First message");
  });

  it("restoreSetting writes the old value back as the current one, plus a new revision", async () => {
    const { setSetting, getSetting, restoreSetting } = await import("../site-settings");

    await setSetting(
      db!,
      "homepage.hero",
      { heading: "Original", subheading: "", imageId: null, ctaLabel: "", ctaHref: "" },
      null,
    );
    const revisions1 = await db!.contentRevision.findMany({
      where: { entityType: "SiteSetting", entityId: "homepage.hero" },
    });
    const originalRevisionId = revisions1[0].id;

    await setSetting(
      db!,
      "homepage.hero",
      { heading: "Changed", subheading: "", imageId: null, ctaLabel: "", ctaHref: "" },
      null,
    );

    await restoreSetting(db!, "homepage.hero", originalRevisionId, null);

    const current = await getSetting(db!, "homepage.hero");
    expect(current.heading).toBe("Original");
  });
});
