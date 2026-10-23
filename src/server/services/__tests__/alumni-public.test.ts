import { describe, expect, it, afterAll } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { listApprovedAlumni, listFeaturedAlumni, countApprovedAlumni } from "../alumni-public";

const db = await getTestDb();

function hasKeyDeep(value: unknown, key: string): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => hasKeyDeep(v, key));
  if (key in (value as Record<string, unknown>)) return true;
  return Object.values(value as Record<string, unknown>).some((v) => hasKeyDeep(v, key));
}

describe.skipIf(db === null)("alumni-public service", () => {
  const createdIds: string[] = [];

  async function createEntry(overrides: Record<string, unknown> = {}) {
    const entry = await db!.alumniEntry.create({
      data: {
        fullName: "Public Test Person",
        email: "public-test@example.com",
        country: "Nigeria",
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `public test person ${Math.random()}|2015`,
        status: "PENDING",
        consentPublicDisplay: true,
        programmes: { create: [{ level: "BSC", graduationYear: 2015 }] },
        ...overrides,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    createdIds.push(entry.id);
    return entry;
  }

  afterAll(async () => {
    await db!.alumniEntry.deleteMany({ where: { id: { in: createdIds } } });
    await db?.$disconnect();
  });

  it("returns only APPROVED entries, excluding PENDING, REJECTED and WITHDRAWN", async () => {
    const approved = await createEntry({ status: "APPROVED", fullName: "Approved Visible Person" });
    await createEntry({ status: "PENDING", fullName: "Pending Hidden Person" });
    await createEntry({ status: "REJECTED", fullName: "Rejected Hidden Person" });
    await createEntry({ status: "WITHDRAWN", fullName: "Withdrawn Hidden Person" });

    const { entries } = await listApprovedAlumni(db!, { page: 1, perPage: 50 });
    const names = entries.map((e) => e.fullName);

    expect(names).toContain(approved.fullName);
    expect(names).not.toContain("Pending Hidden Person");
    expect(names).not.toContain("Rejected Hidden Person");
    expect(names).not.toContain("Withdrawn Hidden Person");
  });

  it("never includes email, consentAt, consentVersion, linkId, reviewedById, rejectionReason or dedupeKey in the payload", async () => {
    await createEntry({ status: "APPROVED", fullName: "Serialization Check Person" });

    const { entries } = await listApprovedAlumni(db!, { page: 1, perPage: 50 });
    for (const forbiddenKey of ["email", "consentAt", "consentVersion", "linkId", "reviewedById", "rejectionReason", "dedupeKey", "withdrawnAt"]) {
      expect(hasKeyDeep(entries, forbiddenKey)).toBe(false);
    }
  });

  it("filters by diacritic-insensitive name search", async () => {
    await createEntry({ status: "APPROVED", fullName: "Ọlá Adéṣọlá", graduationYear: 2018, dedupeKey: `search-test|2018` });

    const { entries } = await listApprovedAlumni(db!, { page: 1, perPage: 50, q: "Ola Adesola" });
    expect(entries.some((e) => e.fullName === "Ọlá Adéṣọlá")).toBe(true);
  });

  it("countApprovedAlumni counts only APPROVED entries", async () => {
    const before = await countApprovedAlumni(db!);
    await createEntry({ status: "APPROVED", fullName: "Count Check Person" });
    const after = await countApprovedAlumni(db!);
    expect(after).toBe(before + 1);
  });

  it("listFeaturedAlumni returns only featured, approved entries, up to the limit", async () => {
    await createEntry({ status: "APPROVED", isFeatured: true, fullName: "Featured One" });
    await createEntry({ status: "APPROVED", isFeatured: true, fullName: "Featured Two" });
    await createEntry({ status: "APPROVED", isFeatured: false, fullName: "Not Featured" });

    const featured = await listFeaturedAlumni(db!, 3);
    const names = featured.map((e) => e.fullName);
    expect(names).toContain("Featured One");
    expect(names).toContain("Featured Two");
    expect(names).not.toContain("Not Featured");
  });
});
