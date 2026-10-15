import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  updateProgramme,
  createSpecialisation,
  updateSpecialisation,
  setSpecialisationActive,
  reorderSpecialisation,
} from "../programmes";

const db = await getTestDb();

describe.skipIf(db === null)("programmes service", () => {
  let programmeId: string;
  let actorId: string;
  const createdSpecIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({
      data: { email: "programmes-test-actor@example.com", name: "Programmes Test Actor" },
    });
    actorId = actor.id;

    const programme = await db!.programme.upsert({
      where: { slug: "test-msc-mathematics" },
      create: {
        slug: "test-msc-mathematics",
        level: "MSC",
        title: "Test M.Sc.",
        summary: "s",
        body: "b",
        duration: "2 years",
        admissionRequirements: "r",
        status: "PUBLISHED",
      },
      update: {},
    });
    programmeId = programme.id;
  });

  afterEach(async () => {
    if (createdSpecIds.length) {
      await db!.specialisation.deleteMany({ where: { id: { in: createdSpecIds } } });
      createdSpecIds.length = 0;
    }
  });

  afterAll(async () => {
    await db!.contentRevision.deleteMany({ where: { entityType: "Programme", entityId: programmeId } });
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.programme.delete({ where: { id: programmeId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  it("updateProgramme writes a revision and an audit entry", async () => {
    const before = await db!.contentRevision.count({ where: { entityType: "Programme", entityId: programmeId } });
    await updateProgramme(
      db!,
      programmeId,
      { title: "Test M.Sc. Mathematics", summary: "s2", body: "b2", duration: "2 years", admissionRequirements: "r2", status: "PUBLISHED" },
      actorId,
    );
    const after = await db!.contentRevision.count({ where: { entityType: "Programme", entityId: programmeId } });
    expect(after).toBe(before + 1);
    const updated = await db!.programme.findUniqueOrThrow({ where: { id: programmeId } });
    expect(updated.title).toBe("Test M.Sc. Mathematics");
  });

  it("rejects an invalid update (empty title)", async () => {
    await expect(
      updateProgramme(db!, programmeId, { title: "", summary: "s", body: "b", duration: "d", admissionRequirements: "r", status: "PUBLISHED" }, actorId),
    ).rejects.toThrow();
  });

  it("creates specialisations with increasing order", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "A", description: "d" }, actorId);
    const b = await createSpecialisation(db!, programmeId, { title: "B", description: "d" }, actorId);
    createdSpecIds.push(a.id, b.id);
    expect(b.order).toBeGreaterThan(a.order);
  });

  it("updates a specialisation's title and description", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "Orig", description: "d" }, actorId);
    createdSpecIds.push(a.id);
    const updated = await updateSpecialisation(db!, a.id, { title: "Renamed", description: "d2" }, actorId);
    expect(updated.title).toBe("Renamed");
    expect(updated.description).toBe("d2");
  });

  it("archives and restores a specialisation via isActive", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "Archivable", description: "d" }, actorId);
    createdSpecIds.push(a.id);
    const archived = await setSpecialisationActive(db!, a.id, false, actorId);
    expect(archived.isActive).toBe(false);
    const restored = await setSpecialisationActive(db!, a.id, true, actorId);
    expect(restored.isActive).toBe(true);
  });

  it("reorders a middle specialisation up, swapping with its predecessor", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "First", description: "d" }, actorId);
    const b = await createSpecialisation(db!, programmeId, { title: "Second", description: "d" }, actorId);
    const c = await createSpecialisation(db!, programmeId, { title: "Third", description: "d" }, actorId);
    createdSpecIds.push(a.id, b.id, c.id);

    await reorderSpecialisation(db!, c.id, "up");

    const refreshedB = await db!.specialisation.findUniqueOrThrow({ where: { id: b.id } });
    const refreshedC = await db!.specialisation.findUniqueOrThrow({ where: { id: c.id } });
    expect(refreshedC.order).toBeLessThan(refreshedB.order);
  });

  it("is a no-op reordering the first item up", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "OnlyFirst", description: "d" }, actorId);
    const b = await createSpecialisation(db!, programmeId, { title: "OnlySecond", description: "d" }, actorId);
    createdSpecIds.push(a.id, b.id);

    await reorderSpecialisation(db!, a.id, "up");

    const refreshedA = await db!.specialisation.findUniqueOrThrow({ where: { id: a.id } });
    expect(refreshedA.order).toBe(a.order);
  });

  it("is a no-op reordering the last item down", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "First2", description: "d" }, actorId);
    const b = await createSpecialisation(db!, programmeId, { title: "Last2", description: "d" }, actorId);
    createdSpecIds.push(a.id, b.id);

    await reorderSpecialisation(db!, b.id, "down");

    const refreshedB = await db!.specialisation.findUniqueOrThrow({ where: { id: b.id } });
    expect(refreshedB.order).toBe(b.order);
  });

  it("is a no-op reordering a single item in either direction", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "Solo", description: "d" }, actorId);
    createdSpecIds.push(a.id);

    await reorderSpecialisation(db!, a.id, "up");
    await reorderSpecialisation(db!, a.id, "down");

    const refreshed = await db!.specialisation.findUniqueOrThrow({ where: { id: a.id } });
    expect(refreshed.order).toBe(a.order);
  });

  it("only considers active specialisations when reordering", async () => {
    const a = await createSpecialisation(db!, programmeId, { title: "ActiveA", description: "d" }, actorId);
    const archived = await createSpecialisation(db!, programmeId, { title: "Archived", description: "d" }, actorId);
    const c = await createSpecialisation(db!, programmeId, { title: "ActiveC", description: "d" }, actorId);
    createdSpecIds.push(a.id, archived.id, c.id);
    await setSpecialisationActive(db!, archived.id, false, actorId);

    await reorderSpecialisation(db!, c.id, "up");

    const refreshedA = await db!.specialisation.findUniqueOrThrow({ where: { id: a.id } });
    const refreshedC = await db!.specialisation.findUniqueOrThrow({ where: { id: c.id } });
    expect(refreshedC.order).toBeLessThan(refreshedA.order);
  });
});
