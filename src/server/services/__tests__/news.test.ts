import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createNewsPost,
  updateNewsPost,
  setNewsPostStatus,
  getNewsPostBySlugAdmin,
  listNewsPostsPublic,
  getPublishedNewsPostBySlug,
  findNewsPostBySlugOrPrevious,
} from "../news";

const db = await getTestDb();

const RUN = Date.now().toString(36);

describe.skipIf(db === null)("news service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: `news-test-actor-${RUN}@example.com`, name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.contentRevision.deleteMany({ where: { entityType: "NewsPost", entityId: { in: createdIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "NewsPost", entityId: { in: createdIds } } });
      await db!.newsPost.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      title: "Test News Post",
      category: "ANNOUNCEMENT" as const,
      excerpt: "An excerpt.",
      body: "<p>Body</p>",
      coverId: null,
      isPinned: false,
      status: "DRAFT" as const,
      publishedAt: null,
      ...overrides,
    };
  }

  it("creates a post with a generated unique slug", async () => {
    const created = await createNewsPost(db!, input(), actorId);
    createdIds.push(created.id);
    expect(created.slug).toBe("test-news-post");
    expect(created.status).toBe("DRAFT");
  });

  it("changing the slug on update pushes the old one into previousSlugs", async () => {
    const created = await createNewsPost(db!, input(), actorId);
    createdIds.push(created.id);

    const updated = await updateNewsPost(db!, created.id, { ...input(), slug: "a-new-slug" }, actorId);
    expect(updated.slug).toBe("a-new-slug");
    expect(updated.previousSlugs).toContain("test-news-post");
  });

  it("does not push to previousSlugs when the slug is unchanged", async () => {
    const created = await createNewsPost(db!, input(), actorId);
    createdIds.push(created.id);

    const updated = await updateNewsPost(db!, created.id, { ...input(), slug: created.slug }, actorId);
    expect(updated.previousSlugs).toEqual([]);
  });

  it("archives and restores via setNewsPostStatus", async () => {
    const created = await createNewsPost(db!, input(), actorId);
    createdIds.push(created.id);

    const archived = await setNewsPostStatus(db!, created.id, "ARCHIVED", actorId);
    expect(archived.status).toBe("ARCHIVED");
    const restored = await setNewsPostStatus(db!, created.id, "DRAFT", actorId);
    expect(restored.status).toBe("DRAFT");
  });

  it("public query excludes DRAFT and ARCHIVED posts", async () => {
    const draft = await createNewsPost(db!, input({ title: "Public Draft Test" }), actorId);
    const published = await createNewsPost(
      db!,
      input({ title: "Public Published Test", status: "PUBLISHED", publishedAt: new Date(Date.now() - 1000) }),
      actorId,
    );
    createdIds.push(draft.id, published.id);

    const list = await listNewsPostsPublic(db!, { page: 1, perPage: 20 });
    const slugs = list.posts.map((p) => p.slug);
    expect(slugs).toContain(published.slug);
    expect(slugs).not.toContain(draft.slug);
  });

  it("public query excludes a PUBLISHED post whose publishedAt is still in the future (scheduling)", async () => {
    const future = await createNewsPost(
      db!,
      input({ title: "Future Scheduled Test", status: "PUBLISHED", publishedAt: new Date(Date.now() + 60 * 60 * 1000) }),
      actorId,
    );
    createdIds.push(future.id);

    const list = await listNewsPostsPublic(db!, { page: 1, perPage: 20 });
    expect(list.posts.map((p) => p.slug)).not.toContain(future.slug);

    const bySlug = await getPublishedNewsPostBySlug(db!, future.slug);
    expect(bySlug).toBeNull();
  });

  it("a PUBLISHED post with a past publishedAt is visible", async () => {
    const past = await createNewsPost(
      db!,
      input({ title: "Past Scheduled Test", status: "PUBLISHED", publishedAt: new Date(Date.now() - 60 * 60 * 1000) }),
      actorId,
    );
    createdIds.push(past.id);

    const bySlug = await getPublishedNewsPostBySlug(db!, past.slug);
    expect(bySlug).not.toBeNull();
  });

  it("pinned posts sort before newer unpinned posts", async () => {
    const older = await createNewsPost(
      db!,
      input({ title: "Older Pinned Test", status: "PUBLISHED", publishedAt: new Date(Date.now() - 10_000), isPinned: true }),
      actorId,
    );
    const newer = await createNewsPost(
      db!,
      input({ title: "Newer Unpinned Test", status: "PUBLISHED", publishedAt: new Date(Date.now() - 1_000) }),
      actorId,
    );
    createdIds.push(older.id, newer.id);

    const list = await listNewsPostsPublic(db!, { page: 1, perPage: 20 });
    const olderIndex = list.posts.findIndex((p) => p.id === older.id);
    const newerIndex = list.posts.findIndex((p) => p.id === newer.id);
    expect(olderIndex).toBeLessThan(newerIndex);
  });

  it("findNewsPostBySlugOrPrevious redirects via previousSlugs", async () => {
    const created = await createNewsPost(db!, input({ status: "PUBLISHED", publishedAt: new Date(Date.now() - 1000) }), actorId);
    createdIds.push(created.id);
    const updated = await updateNewsPost(db!, created.id, { ...input({ status: "PUBLISHED", publishedAt: new Date(Date.now() - 1000) }), slug: "renamed-slug" }, actorId);

    const direct = await findNewsPostBySlugOrPrevious(db!, "renamed-slug");
    expect(direct?.redirectTo).toBeNull();

    const viaOld = await findNewsPostBySlugOrPrevious(db!, updated.previousSlugs[0]);
    expect(viaOld?.redirectTo).toBe("renamed-slug");
  });

  it("never serialises authorId's login email in a public listing", async () => {
    const published = await createNewsPost(
      db!,
      input({ title: "Email Leak Test", status: "PUBLISHED", publishedAt: new Date(Date.now() - 1000) }),
      actorId,
    );
    createdIds.push(published.id);

    const list = await listNewsPostsPublic(db!, { page: 1, perPage: 20 });
    expect(JSON.stringify(list)).not.toContain(`news-test-actor-${RUN}@example.com`);
    expect(JSON.stringify(list)).not.toContain("passwordHash");
  });

  it("getNewsPostBySlugAdmin returns drafts too", async () => {
    const draft = await createNewsPost(db!, input({ title: "Admin Draft Lookup Test" }), actorId);
    createdIds.push(draft.id);
    const found = await getNewsPostBySlugAdmin(db!, draft.slug);
    expect(found?.id).toBe(draft.id);
  });
});
