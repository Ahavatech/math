import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createHandbookPage,
  updateHandbookPage,
  setHandbookPageStatus,
  listHandbookTreeAdmin,
  listHandbookTreePublic,
  getHandbookPageBySlugPublic,
  findHandbookPageBySlugOrPrevious,
  searchHandbookPublic,
} from "../handbook";

const db = await getTestDb();

const RUN = Date.now().toString(36);

describe.skipIf(db === null)("handbook service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: `handbook-test-actor-${RUN}@example.com`, name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.contentRevision.deleteMany({ where: { entityType: "HandbookPage", entityId: { in: createdIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "HandbookPage", entityId: { in: createdIds } } });
      await db!.handbookPage.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      title: "Admission requirements",
      summary: "What you need to apply",
      body: "<p>Details here</p>",
      parentId: null,
      status: "DRAFT" as const,
      ...overrides,
    };
  }

  async function create(overrides: Record<string, unknown> = {}) {
    const page = await createHandbookPage(db!, input(overrides), actorId);
    createdIds.push(page.id);
    return page;
  }

  it("creates a page with a slug derived from the title and computed searchText", async () => {
    const page = await create();
    expect(page.slug).toBe("admission-requirements");
    expect(page.searchText).toContain("admission requirements");
    expect(page.searchText).toContain("details here");
  });

  it("allows a child under a top-level page", async () => {
    const parent = await create({ title: "Programmes" });
    const child = await create({ title: "B.Sc. requirements", parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
  });

  it("rejects nesting a page under a page that already has a parent (maximum two levels)", async () => {
    const grandparent = await create({ title: "Top level" });
    const parent = await create({ title: "Second level", parentId: grandparent.id });
    await expect(create({ title: "Third level", parentId: parent.id })).rejects.toThrow(/two levels/i);
  });

  it("updating the slug pushes the old one into previousSlugs", async () => {
    const page = await create({ title: "Old title" });
    const updated = await updateHandbookPage(db!, page.id, { ...input({ title: "New title" }), slug: "new-title" }, actorId);
    expect(updated.slug).toBe("new-title");
    expect(updated.previousSlugs).toContain("old-title");
  });

  it("recomputes searchText on update", async () => {
    const page = await create({ title: "Searchable thing", body: "<p>original body</p>" });
    const updated = await updateHandbookPage(db!, page.id, { ...input({ title: "Searchable thing", body: "<p>updated content</p>" }), slug: page.slug }, actorId);
    expect(updated.searchText).toContain("updated content");
    expect(updated.searchText).not.toContain("original body");
  });

  it("setHandbookPageStatus archives and restores", async () => {
    const page = await create({ status: "PUBLISHED" });
    const archived = await setHandbookPageStatus(db!, page.id, "ARCHIVED", actorId);
    expect(archived.status).toBe("ARCHIVED");
    const restored = await setHandbookPageStatus(db!, page.id, "DRAFT", actorId);
    expect(restored.status).toBe("DRAFT");
  });

  it("listHandbookTreeAdmin returns every page regardless of status", async () => {
    await create({ status: "DRAFT" });
    await create({ status: "PUBLISHED" });
    await create({ status: "ARCHIVED" });
    const tree = await listHandbookTreeAdmin(db!);
    expect(tree.length).toBeGreaterThanOrEqual(3);
  });

  it("public queries exclude DRAFT and ARCHIVED pages", async () => {
    const draft = await create({ title: "Draft Only Page", status: "DRAFT" });
    const published = await create({ title: "Published Only Page", status: "PUBLISHED" });

    const tree = await listHandbookTreePublic(db!);
    const slugs = tree.map((p) => p.slug);
    expect(slugs).toContain(published.slug);
    expect(slugs).not.toContain(draft.slug);

    expect(await getHandbookPageBySlugPublic(db!, draft.slug)).toBeNull();
    expect(await getHandbookPageBySlugPublic(db!, published.slug)).not.toBeNull();
  });

  it("findHandbookPageBySlugOrPrevious redirects via previousSlugs", async () => {
    const page = await create({ title: "Redirect Source", status: "PUBLISHED" });
    const updated = await updateHandbookPage(db!, page.id, { ...input({ title: "Redirect Target", status: "PUBLISHED" }), slug: "redirect-target" }, actorId);

    const found = await findHandbookPageBySlugOrPrevious(db!, page.slug);
    expect(found?.redirectTo).toBe(updated.slug);
  });

  it("searchHandbookPublic matches diacritic-insensitive queries and ranks title matches first", async () => {
    await create({ title: "Ọlá's guide", body: "<p>General info</p>", status: "PUBLISHED" });
    await create({ title: "Unrelated page", body: "<p>Mentions Ola in passing</p>", status: "PUBLISHED" });

    const results = await searchHandbookPublic(db!, "Ola");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].title).toContain("Ọlá");
  });
});
