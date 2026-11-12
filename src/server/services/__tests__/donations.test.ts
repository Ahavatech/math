import { describe, expect, it, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { getDonationsPublic } from "../donations";
import { setSetting } from "../site-settings";
import { DONATIONS_DEFAULT } from "@/lib/validators/donations";

const db = await getTestDb();
const RUN = Date.now().toString(36);

const configured = {
  ...DONATIONS_DEFAULT,
  enabled: true,
  accountName: "Test Gifts Account",
  bankName: "Test Bank",
  accountNumber: "0000000000",
};

describe.skipIf(db === null)("getDonationsPublic", () => {
  let actorId: string;

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: `donations-test-${RUN}@example.com`, name: "Actor" } });
    actorId = actor.id;
  });

  // Other test files (the seed test) can leave this setting behind, so each
  // test starts from nothing saved.
  beforeEach(async () => {
    await db!.siteSetting.deleteMany({ where: { key: "donations.details" } });
  });

  afterEach(async () => {
    await db!.siteSetting.deleteMany({ where: { key: "donations.details" } });
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.contentRevision.deleteMany({ where: { entityId: "donations.details" } });
    await db!.siteSetting.deleteMany({ where: { key: "donations.details" } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  it("returns null when nothing has been saved", async () => {
    expect(await getDonationsPublic(db!)).toBeNull();
  });

  it("returns null while the page is switched off, even with details saved", async () => {
    await setSetting(db!, "donations.details", { ...configured, enabled: false }, actorId);
    expect(await getDonationsPublic(db!)).toBeNull();
  });

  it("returns the details and when they were last changed once switched on", async () => {
    await setSetting(db!, "donations.details", configured, actorId);
    const result = await getDonationsPublic(db!);
    expect(result?.details.accountNumber).toBe("0000000000");
    expect(result?.updatedAt).toBeInstanceOf(Date);
  });

  it("refuses to save an enabled configuration with no account number", async () => {
    await expect(
      setSetting(db!, "donations.details", { ...configured, accountNumber: "" }, actorId),
    ).rejects.toThrow();
  });

  it("records every change in the audit log and revision history", async () => {
    await setSetting(db!, "donations.details", configured, actorId);
    const audit = await db!.auditLog.count({ where: { actorId, entityId: "donations.details" } });
    const revisions = await db!.contentRevision.count({ where: { entityId: "donations.details" } });
    expect(audit).toBeGreaterThan(0);
    expect(revisions).toBeGreaterThan(0);
  });
});
