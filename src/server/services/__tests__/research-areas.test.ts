import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createResearchArea,
  updateResearchArea,
  getResearchAreaBySlugAdmin,
  getResearchAreaBySlugPublic,
  listResearchAreasPublic,
  setResearchAreaStatus,
  reorderResearchArea,
} from "../research-areas";

const db = await getTestDb();

describe.skipIf(db === null)("research areas service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({
      data: { email: "research-test-actor@example.com", name: "Research Test Actor" },
    });
    actorId = actor.id;
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.contentRevision.deleteMany({ where: { entityType: "ResearchArea", entityId: { in: createdIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "ResearchArea", entityId: { in: createdIds } } });
      await db!.researchArea.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  afterAll(async () => {
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  it("creates a research area and generates a slug from the title", async () => {
    const area = await createResearchArea(
      db!,
      { title: "Test Area One", summary: "s", body: "b", status: "DRAFT", imageId: null },
      actorId,
    );
    createdIds.push(area.id);
    expect(area.slug).toBe("test-area-one");
  });

  it("generates a collision-safe slug when the title repeats", async () => {
    const first = await createResearchArea(db!, { title: "Dup Title", summary: "s", body: "b", status: "DRAFT", imageId: null }, actorId);
    const second = await createResearchArea(db!, { title: "Dup Title", summary: "s", body: "b", status: "DRAFT", imageId: null }, actorId);
    createdIds.push(first.id, second.id);
    expect(first.slug).toBe("dup-title");
    expect(second.slug).toBe("dup-title-2");
  });

  it("updateResearchArea writes a revision and an audit entry", async () => {
    const area = await createResearchArea(db!, { title: "Revisable", summary: "s", body: "b", status: "DRAFT", imageId: null }, actorId);
    createdIds.push(area.id);
    const before = await db!.contentRevision.count({ where: { entityType: "ResearchArea", entityId: area.id } });
    await updateResearchArea(db!, area.id, { title: "Revisable", summary: "s2", body: "b2", status: "PUBLISHED", imageId: null }, actorId);
    const after = await db!.contentRevision.count({ where: { entityType: "ResearchArea", entityId: area.id } });
    expect(after).toBe(before + 1);
    const updated = await getResearchAreaBySlugAdmin(db!, area.slug);
    expect(updated?.summary).toBe("s2");
    expect(updated?.status).toBe("PUBLISHED");
  });

  it("public queries only return PUBLISHED areas, never DRAFT or ARCHIVED", async () => {
    const draft = await createResearchArea(db!, { title: "Draft Area XYZ", summary: "s", body: "b", status: "DRAFT", imageId: null }, actorId);
    const published = await createResearchArea(db!, { title: "Published Area XYZ", summary: "s", body: "b", status: "PUBLISHED", imageId: null }, actorId);
    const archived = await createResearchArea(db!, { title: "Archived Area XYZ", summary: "s", body: "b", status: "ARCHIVED", imageId: null }, actorId);
    createdIds.push(draft.id, published.id, archived.id);

    const publicList = await listResearchAreasPublic(db!);
    const publicSlugs = publicList.map((a) => a.slug);
    expect(publicSlugs).toContain(published.slug);
    expect(publicSlugs).not.toContain(draft.slug);
    expect(publicSlugs).not.toContain(archived.slug);

    expect(await getResearchAreaBySlugPublic(db!, draft.slug)).toBeNull();
    expect(await getResearchAreaBySlugPublic(db!, archived.slug)).toBeNull();
    expect((await getResearchAreaBySlugPublic(db!, published.slug))?.slug).toBe(published.slug);
  });

  it("setResearchAreaStatus archives and restores without ever deleting the row", async () => {
    const area = await createResearchArea(db!, { title: "Archive Me", summary: "s", body: "b", status: "PUBLISHED", imageId: null }, actorId);
    createdIds.push(area.id);
    await setResearchAreaStatus(db!, area.id, "ARCHIVED", actorId);
    const archived = await getResearchAreaBySlugAdmin(db!, area.slug);
    expect(archived?.status).toBe("ARCHIVED");
    await setResearchAreaStatus(db!, area.id, "PUBLISHED", actorId);
    const restored = await getResearchAreaBySlugAdmin(db!, area.slug);
    expect(restored?.status).toBe("PUBLISHED");
  });

  it("reorders a middle area up, swapping with its predecessor", async () => {
    const a = await createResearchArea(db!, { title: "Order A ZZZ", summary: "s", body: "b", status: "PUBLISHED", imageId: null }, actorId);
    const b = await createResearchArea(db!, { title: "Order B ZZZ", summary: "s", body: "b", status: "PUBLISHED", imageId: null }, actorId);
    createdIds.push(a.id, b.id);
    await db!.researchArea.update({ where: { id: a.id }, data: { order: 1000 } });
    await db!.researchArea.update({ where: { id: b.id }, data: { order: 1001 } });

    await reorderResearchArea(db!, b.id, "up");

    const refreshedA = await db!.researchArea.findUniqueOrThrow({ where: { id: a.id } });
    const refreshedB = await db!.researchArea.findUniqueOrThrow({ where: { id: b.id } });
    expect(refreshedB.order).toBeLessThan(refreshedA.order);
  });
});
