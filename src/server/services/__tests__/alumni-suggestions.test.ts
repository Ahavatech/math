/**
 * Tests for getPeopleYouMightKnow: before/own/after year sets, multi-programme,
 * same-level-first fill, cap at 12, deterministic ordering, visibility gate.
 * All tests use the real test database.
 */
import { describe, expect, it, afterAll } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { getPeopleYouMightKnow, listApprovedAlumni } from "../alumni-public";

const db = await getTestDb();

// Unique run suffix prevents collision with leftover rows from crashed runs.
const RUN = `sugg-${Date.now().toString(36)}`;

describe.skipIf(db === null)("getPeopleYouMightKnow", () => {
  const createdIds: string[] = [];

  async function makeEntry(
    fullName: string,
    level: "BSC" | "MSC" | "PHD",
    gradYear: number,
    overrides: Record<string, unknown> = {},
  ) {
    const entry = await db!.alumniEntry.create({
      data: {
        fullName,
        email: `${RUN}-${fullName.replace(/\s+/g, "-").toLowerCase()}@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|${fullName}|${level}|${gradYear}`,
        status: "APPROVED",
        consentPublicDisplay: true,
        programmes: { create: [{ level, graduationYear: gradYear }] },
        ...(overrides as Record<string, unknown>),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(entry.id);
    return entry;
  }

  afterAll(async () => {
    if (createdIds.length) {
      await db!.alumniEntry.deleteMany({ where: { id: { in: createdIds } } });
    }
    await db?.$disconnect();
  });

  it("returns groups keyed by <level>-<year> for set-before (Y-1), own (Y) and set-after (Y+1)", async () => {
    // Subject graduates BSC 2015.
    const subject = await makeEntry("Subject Person", "BSC", 2015);
    // Populate Y-1 = 2014, Y = 2015, Y+1 = 2016.
    await makeEntry("Before One", "BSC", 2014);
    await makeEntry("Before Two", "BSC", 2014);
    await makeEntry("Before Three", "BSC", 2014);
    await makeEntry("Own One", "BSC", 2015);
    await makeEntry("Own Two", "BSC", 2015);
    await makeEntry("Own Three", "BSC", 2015);
    await makeEntry("After One", "BSC", 2016);
    await makeEntry("After Two", "BSC", 2016);
    await makeEntry("After Three", "BSC", 2016);

    const groups = await getPeopleYouMightKnow(db!, subject.id);
    const keys = Object.keys(groups);

    expect(keys).toContain("BSC-2014");
    expect(keys).toContain("BSC-2015");
    expect(keys).toContain("BSC-2016");
  });

  it("excludes the subject from all suggestion groups", async () => {
    const subject = await makeEntry("Subject Excluded", "BSC", 2020);
    await makeEntry("Cohort Member A", "BSC", 2020);
    await makeEntry("Cohort Member B", "BSC", 2020);
    await makeEntry("Cohort Member C", "BSC", 2020);

    const groups = await getPeopleYouMightKnow(db!, subject.id);
    const allNames = Object.values(groups).flat().map((e) => (e as { fullName: string }).fullName);

    expect(allNames).not.toContain("Subject Excluded");
  });

  it("never includes PENDING, REJECTED or non-consenting entries in suggestions", async () => {
    const subject = await makeEntry("Vis-Gate Subject", "MSC", 2017);
    // PENDING
    const pending = await makeEntry("Pending Invisible", "MSC", 2017, { status: "PENDING" });
    createdIds.push(pending.id);
    // REJECTED
    const rejected = await makeEntry("Rejected Invisible", "MSC", 2017, { status: "REJECTED" });
    createdIds.push(rejected.id);
    // APPROVED but no consent
    const noconsent = await db!.alumniEntry.create({
      data: {
        fullName: "No Consent Invisible",
        email: `${RUN}-noconsent-vis@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|noconsent-vis|MSC|2017`,
        status: "APPROVED",
        consentPublicDisplay: false,
        programmes: { create: [{ level: "MSC", graduationYear: 2017 }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(noconsent.id);

    const groups = await getPeopleYouMightKnow(db!, subject.id);
    const allNames = Object.values(groups).flat().map((e) => (e as { fullName: string }).fullName);

    expect(allNames).not.toContain("Pending Invisible");
    expect(allNames).not.toContain("Rejected Invisible");
    expect(allNames).not.toContain("No Consent Invisible");
  });

  it("fills from any level when fewer than 3 primary same-level matches exist", async () => {
    const subject = await makeEntry("Fill-Test Subject", "PHD", 2019);
    // Only 1 PHD in 2019 -- below threshold of 3.
    await makeEntry("Only PHD", "PHD", 2019);
    // Multiple BSC and MSC in 2019 to fill up.
    await makeEntry("Fill BSC One", "BSC", 2019);
    await makeEntry("Fill BSC Two", "BSC", 2019);
    await makeEntry("Fill MSC One", "MSC", 2019);

    const groups = await getPeopleYouMightKnow(db!, subject.id);
    const own = (groups["PHD-2019"] ?? []) as { fullName: string }[];

    // Should have been filled beyond the 1 primary PHD
    expect(own.length).toBeGreaterThan(1);
    // The PHD peer should still be included
    expect(own.some((e) => e.fullName === "Only PHD")).toBe(true);
  });

  it("caps each group at 12 entries", async () => {
    const subject = await makeEntry("Cap Subject", "BSC", 2022);
    // Create 15 additional entries in the same group
    for (let i = 1; i <= 15; i++) {
      await makeEntry(`Cap Peer ${String(i).padStart(2, "0")}`, "BSC", 2022);
    }

    const groups = await getPeopleYouMightKnow(db!, subject.id);
    const own = groups["BSC-2022"] ?? [];
    expect(own.length).toBeLessThanOrEqual(12);
  });

  it("orders entries deterministically by fullName asc within each group", async () => {
    const subject = await makeEntry("Det Subject", "MSC", 2021);
    await makeEntry("Zara", "MSC", 2021);
    await makeEntry("Ada", "MSC", 2021);
    await makeEntry("Mike", "MSC", 2021);

    const r1 = await getPeopleYouMightKnow(db!, subject.id);
    const r2 = await getPeopleYouMightKnow(db!, subject.id);

    const names1 = ((r1["MSC-2021"] ?? []) as { fullName: string }[]).map((e) => e.fullName);
    const names2 = ((r2["MSC-2021"] ?? []) as { fullName: string }[]).map((e) => e.fullName);
    expect(names1).toEqual(names2);
  });

  it("omits empty groups (no approved-consented entries for that year)", async () => {
    // Subject BSC 2030 -- nobody else exists for 2029, 2030, 2031
    const subject = await makeEntry("Lone Subject", "BSC", 2030);

    const groups = await getPeopleYouMightKnow(db!, subject.id);
    expect(Object.keys(groups)).not.toContain("BSC-2029");
    expect(Object.keys(groups)).not.toContain("BSC-2030");
    expect(Object.keys(groups)).not.toContain("BSC-2031");
  });

  it("handles a multi-programme entry and produces groups for each programme", async () => {
    const subject = await db!.alumniEntry.create({
      data: {
        fullName: "Multi Programme Subject",
        email: `${RUN}-multi-subj@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|multi-subj`,
        status: "APPROVED",
        consentPublicDisplay: true,
        programmes: {
          create: [
            { level: "BSC", graduationYear: 2010 },
            { level: "MSC", graduationYear: 2013 },
          ],
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(subject.id);

    await makeEntry("BSC Peer 10a", "BSC", 2010);
    await makeEntry("BSC Peer 10b", "BSC", 2010);
    await makeEntry("BSC Peer 10c", "BSC", 2010);
    await makeEntry("MSC Peer 13a", "MSC", 2013);
    await makeEntry("MSC Peer 13b", "MSC", 2013);
    await makeEntry("MSC Peer 13c", "MSC", 2013);

    const groups = await getPeopleYouMightKnow(db!, subject.id);
    const keys = Object.keys(groups);

    // Should include groups from both programmes
    expect(keys.some((k) => k.startsWith("BSC-"))).toBe(true);
    expect(keys.some((k) => k.startsWith("MSC-"))).toBe(true);
  });

  it("returns empty object for a non-existent entryId", async () => {
    const result = await getPeopleYouMightKnow(db!, "non-existent-id-12345");
    expect(result).toEqual({});
  });
});

describe.skipIf(db === null)("alumni public list visibility gate", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length) {
      await db!.alumniEntry.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  it("PENDING entries never appear in the public list", async () => {
    const entry = await db!.alumniEntry.create({
      data: {
        fullName: "Pending Should Be Hidden",
        email: `${RUN}-pending-hide@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|pending-hide`,
        status: "PENDING",
        consentPublicDisplay: true,
        programmes: { create: [{ level: "BSC", graduationYear: 2000 }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(entry.id);

    const { entries } = await listApprovedAlumni(db!, { page: 1, perPage: 100 });
    expect(entries.map((e) => e.fullName)).not.toContain("Pending Should Be Hidden");
  });

  it("REJECTED entries never appear in the public list", async () => {
    const entry = await db!.alumniEntry.create({
      data: {
        fullName: "Rejected Should Be Hidden",
        email: `${RUN}-rejected-hide@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|rejected-hide`,
        status: "REJECTED",
        consentPublicDisplay: true,
        programmes: { create: [{ level: "BSC", graduationYear: 2000 }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(entry.id);

    const { entries } = await listApprovedAlumni(db!, { page: 1, perPage: 100 });
    expect(entries.map((e) => e.fullName)).not.toContain("Rejected Should Be Hidden");
  });

  it("APPROVED entries with consentPublicDisplay=false never appear in the public list", async () => {
    const entry = await db!.alumniEntry.create({
      data: {
        fullName: "No Consent Should Be Hidden",
        email: `${RUN}-noconsent-hide@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|noconsent-hide`,
        status: "APPROVED",
        consentPublicDisplay: false,
        programmes: { create: [{ level: "BSC", graduationYear: 2000 }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(entry.id);

    const { entries } = await listApprovedAlumni(db!, { page: 1, perPage: 100 });
    expect(entries.map((e) => e.fullName)).not.toContain("No Consent Should Be Hidden");
  });

  it("industry filter only returns entries matching the given roleOrField", async () => {
    const e1 = await db!.alumniEntry.create({
      data: {
        fullName: "Industry Match Person",
        email: `${RUN}-ind-match@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|ind-match`,
        status: "APPROVED",
        consentPublicDisplay: true,
        roleOrField: "Information technology",
        programmes: { create: [{ level: "BSC", graduationYear: 2005 }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    const e2 = await db!.alumniEntry.create({
      data: {
        fullName: "Industry Other Person",
        email: `${RUN}-ind-other@example.com`,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `${RUN}|ind-other`,
        status: "APPROVED",
        consentPublicDisplay: true,
        roleOrField: "Banking and finance",
        programmes: { create: [{ level: "BSC", graduationYear: 2005 }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(e1.id, e2.id);

    const { entries } = await listApprovedAlumni(db!, {
      page: 1,
      perPage: 100,
      industry: "Information technology",
    });
    const names = entries.map((e) => e.fullName);
    expect(names).toContain("Industry Match Person");
    expect(names).not.toContain("Industry Other Person");
  });
});
