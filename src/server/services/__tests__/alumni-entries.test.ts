import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: {
    api: { resource: vi.fn(), delete_resources: vi.fn().mockResolvedValue({}) },
    uploader: { rename: vi.fn().mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg" }) },
    url: vi.fn(),
  },
  ALLOWED_IMAGE_FORMATS: ["jpg", "jpeg", "png", "webp", "avif"],
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
}));

import {
  submitAlumniEntry,
  findPossibleDuplicates,
  approveAlumniEntry,
  rejectAlumniEntry,
  withdrawAlumniEntry,
  restoreWithdrawnAlumniEntry,
  eraseAlumniEntry,
  markDuplicate,
  bulkApprove,
  updateAlumniEntry,
  setFeatured,
  getAlumniEntryAdmin,
} from "../alumni-entries";

const db = await getTestDb();

describe.skipIf(db === null)("alumni-entries service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: "alumni-entries-test-actor@example.com", name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.auditLog.deleteMany({ where: { entityType: "AlumniEntry", entityId: { in: createdIds } } });
      await db!.alumniEntry.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  function fields(overrides: Record<string, unknown> = {}) {
    return {
      fullName: "Test Alumnus",
      email: "test-alumnus@example.com",
      level: "BSC" as const,
      graduationYear: 2012,
      organisation: "Acme",
      roleTitle: "Engineer",
      city: "Ife",
      country: "Nigeria",
      industry: "Information technology",
      linkedinUrl: "",
      ...overrides,
    };
  }

  async function submit(overrides: Record<string, unknown> = {}) {
    const entry = await submitAlumniEntry(db!, { linkId: null, data: fields(overrides), photoMediaId: null });
    createdIds.push(entry.id);
    return entry;
  }

  it("creates a PENDING entry with a computed dedupeKey and stamped consent", async () => {
    const entry = await submit();
    expect(entry.status).toBe("PENDING");
    expect(entry.dedupeKey).toContain("2012");
    expect(entry.consentVersion).toBe("v1");
    expect(entry.consentAt).toBeInstanceOf(Date);
  });

  it("findPossibleDuplicates finds a PENDING or APPROVED entry with the same dedupeKey, excluding itself", async () => {
    const first = await submit({ fullName: "Duplicate Person" });
    const second = await submit({ fullName: "Duplicate Person" });

    const dupes = await findPossibleDuplicates(db!, second.dedupeKey, second.id);
    expect(dupes.map((d) => d.id)).toEqual([first.id]);
  });

  it("approve moves PENDING to APPROVED and stamps reviewedById/reviewedAt", async () => {
    const entry = await submit();
    const approved = await approveAlumniEntry(db!, entry.id, actorId, {});
    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewedById).toBe(actorId);
    expect(approved.reviewedAt).toBeInstanceOf(Date);
  });

  it("approve with feature:true sets isFeatured", async () => {
    const entry = await submit();
    const approved = await approveAlumniEntry(db!, entry.id, actorId, { feature: true });
    expect(approved.isFeatured).toBe(true);
  });

  it("reject moves PENDING to REJECTED and stores the reason", async () => {
    const entry = await submit();
    const rejected = await rejectAlumniEntry(db!, entry.id, "Could not verify details", actorId);
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Could not verify details");
  });

  it("withdraw is reversible: APPROVED -> WITHDRAWN -> APPROVED keeps the data", async () => {
    const entry = await submit();
    await approveAlumniEntry(db!, entry.id, actorId, {});
    const withdrawn = await withdrawAlumniEntry(db!, entry.id, actorId);
    expect(withdrawn.status).toBe("WITHDRAWN");
    expect(withdrawn.withdrawnAt).toBeInstanceOf(Date);

    const restored = await restoreWithdrawnAlumniEntry(db!, entry.id, actorId);
    expect(restored.status).toBe("APPROVED");
    expect(restored.fullName).toBe(entry.fullName);
  });

  it("rejects an illegal transition (REJECTED cannot be approved)", async () => {
    const entry = await submit();
    await rejectAlumniEntry(db!, entry.id, "no", actorId);
    await expect(approveAlumniEntry(db!, entry.id, actorId, {})).rejects.toThrow();
  });

  it("erase permanently deletes the row from any status", async () => {
    const entry = await submit();
    await approveAlumniEntry(db!, entry.id, actorId, {});
    await eraseAlumniEntry(db!, entry.id, actorId);

    const found = await db!.alumniEntry.findUnique({ where: { id: entry.id } });
    expect(found).toBeNull();
    createdIds.splice(createdIds.indexOf(entry.id), 1);
  });

  it("AuditLog summaries for alumni actions never contain the entry's name or email", async () => {
    const entry = await submit({ fullName: "Secret Name Example", email: "secret-email@example.com" });
    await approveAlumniEntry(db!, entry.id, actorId, {});
    await withdrawAlumniEntry(db!, entry.id, actorId);

    const logs = await db!.auditLog.findMany({ where: { entityType: "AlumniEntry", entityId: entry.id } });
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(log.summary).not.toContain("Secret Name Example");
      expect(log.summary).not.toContain("secret-email@example.com");
    }
  });

  it("markDuplicate 'replace' withdraws the existing entry and approves the new one", async () => {
    const existing = await submit({ fullName: "Replace Target" });
    await approveAlumniEntry(db!, existing.id, actorId, {});
    const incoming = await submit({ fullName: "Replace Target" });

    await markDuplicate(db!, incoming.id, existing.id, "replace", actorId);

    const existingAfter = await db!.alumniEntry.findUniqueOrThrow({ where: { id: existing.id } });
    const incomingAfter = await db!.alumniEntry.findUniqueOrThrow({ where: { id: incoming.id } });
    expect(existingAfter.status).toBe("WITHDRAWN");
    expect(incomingAfter.status).toBe("APPROVED");
  });

  it("markDuplicate 'reject' rejects the new entry and leaves the existing one untouched", async () => {
    const existing = await submit({ fullName: "Reject Dup Target" });
    await approveAlumniEntry(db!, existing.id, actorId, {});
    const incoming = await submit({ fullName: "Reject Dup Target" });

    await markDuplicate(db!, incoming.id, existing.id, "reject", actorId);

    const existingAfter = await db!.alumniEntry.findUniqueOrThrow({ where: { id: existing.id } });
    const incomingAfter = await db!.alumniEntry.findUniqueOrThrow({ where: { id: incoming.id } });
    expect(existingAfter.status).toBe("APPROVED");
    expect(incomingAfter.status).toBe("REJECTED");
  });

  it("bulkApprove skips entries with a duplicate flag and approves the rest", async () => {
    const clean = await submit({ fullName: "Bulk Clean Person" });
    const dupA = await submit({ fullName: "Bulk Dup Person" });
    const dupB = await submit({ fullName: "Bulk Dup Person" });

    const result = await bulkApprove(db!, [clean.id, dupA.id, dupB.id], actorId);

    expect(result.approved).toContain(clean.id);
    expect(result.skipped).toContain(dupA.id);
    expect(result.skipped).toContain(dupB.id);

    const cleanAfter = await db!.alumniEntry.findUniqueOrThrow({ where: { id: clean.id } });
    const dupAAfter = await db!.alumniEntry.findUniqueOrThrow({ where: { id: dupA.id } });
    expect(cleanAfter.status).toBe("APPROVED");
    expect(dupAAfter.status).toBe("PENDING");
  });

  it("updateAlumniEntry edits fields before approval", async () => {
    const entry = await submit({ organisation: "Old Org" });
    const updated = await updateAlumniEntry(db!, entry.id, { organisation: "New Org" }, actorId);
    expect(updated.organisation).toBe("New Org");
  });

  it("getAlumniEntryAdmin never exposes a raw Cloudinary URL for a pending entry's photo", async () => {
    const entry = await submit();
    await db!.alumniEntry.update({
      where: { id: entry.id },
      data: {
        photo: {
          create: {
            provider: "cloudinary",
            publicId: "oau-maths/alumni/pending/test-photo",
            url: "https://res.cloudinary.com/demo/image/authenticated/s--sig--/v1/oau-maths/alumni/pending/test-photo.jpg",
            alt: "Alumni photo",
            deliveryType: "authenticated",
          },
        },
      },
    });

    const admin = await getAlumniEntryAdmin(db!, entry.id);
    const serialized = JSON.stringify(admin);
    expect(serialized).not.toContain("res.cloudinary.com");
    expect(admin.photoUrl).toBe(`/api/alumni-photo/${entry.id}`);

    const photoId = admin.photoId!;
    await db!.alumniEntry.update({ where: { id: entry.id }, data: { photoId: null } });
    await db!.mediaAsset.delete({ where: { id: photoId } });
  });

  it("setFeatured toggles isFeatured on an approved entry", async () => {
    const entry = await submit();
    await approveAlumniEntry(db!, entry.id, actorId, {});
    const featured = await setFeatured(db!, entry.id, true, actorId);
    expect(featured.isFeatured).toBe(true);
    const unfeatured = await setFeatured(db!, entry.id, false, actorId);
    expect(unfeatured.isFeatured).toBe(false);
  });
});
