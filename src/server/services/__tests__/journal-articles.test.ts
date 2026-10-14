import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createArticle,
  updateArticle,
  setArticleStatus,
  findPossibleDuplicateArticle,
  getPublishingChecklist,
  isArticlePublic,
  listArticlesPublic,
  getArticleBySlugPublic,
} from "../journal-articles";

const db = await getTestDb();

describe("isArticlePublic (pure)", () => {
  it("is public when PUBLISHED with no issue (online first)", () => {
    expect(isArticlePublic({ status: "PUBLISHED", issue: null })).toBe(true);
  });

  it("is public when PUBLISHED and its issue is PUBLISHED", () => {
    expect(isArticlePublic({ status: "PUBLISHED", issue: { status: "PUBLISHED" } })).toBe(true);
  });

  it("is hidden when the article itself is DRAFT, even with a PUBLISHED issue", () => {
    expect(isArticlePublic({ status: "DRAFT", issue: { status: "PUBLISHED" } })).toBe(false);
  });

  it("is hidden when PUBLISHED but its issue is DRAFT", () => {
    expect(isArticlePublic({ status: "PUBLISHED", issue: { status: "DRAFT" } })).toBe(false);
  });

  it("is hidden when PUBLISHED but its issue is ARCHIVED", () => {
    expect(isArticlePublic({ status: "PUBLISHED", issue: { status: "ARCHIVED" } })).toBe(false);
  });
});

describe.skipIf(db === null)("journal-articles service", () => {
  let actorId: string;
  const createdArticleIds: string[] = [];
  const createdIssueIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: "journal-articles-test-actor@example.com", name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdArticleIds.length) {
      await db!.articleAuthor.deleteMany({ where: { articleId: { in: createdArticleIds } } });
      await db!.contentRevision.deleteMany({ where: { entityType: "Article", entityId: { in: createdArticleIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "Article", entityId: { in: createdArticleIds } } });
      await db!.article.deleteMany({ where: { id: { in: createdArticleIds } } });
      createdArticleIds.length = 0;
    }
    if (createdIssueIds.length) {
      await db!.journalIssue.deleteMany({ where: { id: { in: createdIssueIds } } });
      createdIssueIds.length = 0;
    }
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      title: "On the Classification of Finite Groups",
      abstract: "<p>An abstract.</p>",
      keywords: ["algebra"],
      authors: [{ name: "Jane Doe", order: 0 }],
      issueId: null,
      status: "DRAFT",
      ...overrides,
    };
  }

  it("creates an article with a slug derived from the title", async () => {
    const created = await createArticle(db!, input(), actorId);
    createdArticleIds.push(created.id);
    expect(created.slug).toBe("on-the-classification-of-finite-groups");
  });

  it("re-derives the slug on an edit before first publication", async () => {
    const created = await createArticle(db!, input(), actorId);
    createdArticleIds.push(created.id);
    const updated = await updateArticle(db!, created.id, input({ title: "A Totally Different Title" }), actorId);
    expect(updated.slug).toBe("a-totally-different-title");
  });

  it("keeps the slug fixed once the article has been published, even if the title changes", async () => {
    const created = await createArticle(db!, input({ status: "PUBLISHED" }), actorId);
    createdArticleIds.push(created.id);
    expect(created.publishedAt).not.toBeNull();

    const updated = await updateArticle(db!, created.id, input({ title: "A New Title After Publishing", status: "PUBLISHED" }), actorId);
    expect(updated.slug).toBe(created.slug);
    expect(updated.title).toBe("A New Title After Publishing");
  });

  it("stamps publishedAt exactly once, the first time status becomes PUBLISHED", async () => {
    const created = await createArticle(db!, input(), actorId);
    createdArticleIds.push(created.id);
    expect(created.publishedAt).toBeNull();

    const published = await setArticleStatus(db!, created.id, "PUBLISHED", actorId);
    expect(published.publishedAt).not.toBeNull();
    const firstPublishedAt = published.publishedAt;

    const unpublished = await setArticleStatus(db!, created.id, "DRAFT", actorId);
    expect(unpublished.publishedAt).toEqual(firstPublishedAt);

    const republished = await setArticleStatus(db!, created.id, "PUBLISHED", actorId);
    expect(republished.publishedAt).toEqual(firstPublishedAt);
  });

  it("findPossibleDuplicateArticle finds an existing article with the same normalised title in the same issue (warning, not a block)", async () => {
    const issue = await db!.journalIssue.create({ data: { volume: 1, number: 1, year: 2026 } });
    createdIssueIds.push(issue.id);

    const created = await createArticle(db!, input({ issueId: issue.id }), actorId);
    createdArticleIds.push(created.id);

    const duplicate = await findPossibleDuplicateArticle(db!, "  on the classification of finite groups  ", issue.id);
    expect(duplicate?.id).toBe(created.id);

    // a second create with the same title and issue is NOT blocked by the service itself
    const second = await createArticle(db!, input({ issueId: issue.id }), actorId);
    createdArticleIds.push(second.id);
    expect(second.id).not.toBe(created.id);
  });

  it("findPossibleDuplicateArticle does not flag the same title in a different issue", async () => {
    const issueA = await db!.journalIssue.create({ data: { volume: 2, number: 1, year: 2026 } });
    const issueB = await db!.journalIssue.create({ data: { volume: 2, number: 2, year: 2026 } });
    createdIssueIds.push(issueA.id, issueB.id);

    const created = await createArticle(db!, input({ issueId: issueA.id }), actorId);
    createdArticleIds.push(created.id);

    const duplicate = await findPossibleDuplicateArticle(db!, "On the Classification of Finite Groups", issueB.id);
    expect(duplicate).toBeNull();
  });

  it("getPublishingChecklist reports every requirement unmet on a bare draft", async () => {
    const created = await db!.article.create({
      data: { slug: `checklist-bare-${Date.now()}`, title: "", abstract: "", keywords: [] },
    });
    createdArticleIds.push(created.id);

    const checklist = await getPublishingChecklist(db!, created.id);
    expect(checklist.every((c) => !c.met)).toBe(true);
  });

  it("getPublishingChecklist reports title/abstract/author met, PDF unmet, without a PDF", async () => {
    const created = await createArticle(db!, input(), actorId);
    createdArticleIds.push(created.id);

    const checklist = await getPublishingChecklist(db!, created.id);
    const byLabel = Object.fromEntries(checklist.map((c) => [c.label, c.met]));
    expect(byLabel["Title"]).toBe(true);
    expect(byLabel["Abstract"]).toBe(true);
    expect(byLabel["At least one author"]).toBe(true);
    expect(byLabel["PDF uploaded and verified"]).toBe(false);
  });

  it("visibility: unpublishing an issue hides its otherwise-published articles from the public list and detail page", async () => {
    const issue = await db!.journalIssue.create({ data: { volume: 3, number: 1, year: 2026, status: "PUBLISHED", publishedAt: new Date() } });
    createdIssueIds.push(issue.id);

    const created = await createArticle(db!, input({ issueId: issue.id, status: "PUBLISHED" }), actorId);
    createdArticleIds.push(created.id);

    const visible = await getArticleBySlugPublic(db!, created.slug);
    expect(visible?.id).toBe(created.id);

    await db!.journalIssue.update({ where: { id: issue.id }, data: { status: "DRAFT" } });

    const hidden = await getArticleBySlugPublic(db!, created.slug);
    expect(hidden).toBeNull();

    const { articles } = await listArticlesPublic(db!, { perPage: 50 });
    expect(articles.some((a) => a.id === created.id)).toBe(false);
  });

  it("visibility: a DRAFT article never appears publicly even with a PUBLISHED issue", async () => {
    const issue = await db!.journalIssue.create({ data: { volume: 4, number: 1, year: 2026, status: "PUBLISHED", publishedAt: new Date() } });
    createdIssueIds.push(issue.id);

    const created = await createArticle(db!, input({ issueId: issue.id, status: "DRAFT" }), actorId);
    createdArticleIds.push(created.id);

    expect(await getArticleBySlugPublic(db!, created.slug)).toBeNull();
  });

  it("visibility: an online-first PUBLISHED article (no issue) is public", async () => {
    const created = await createArticle(db!, input({ issueId: null, status: "PUBLISHED" }), actorId);
    createdArticleIds.push(created.id);

    const visible = await getArticleBySlugPublic(db!, created.slug);
    expect(visible?.id).toBe(created.id);
  });

  it("public query never selects searchText", async () => {
    const created = await createArticle(db!, input({ status: "PUBLISHED" }), actorId);
    createdArticleIds.push(created.id);

    const visible = await getArticleBySlugPublic(db!, created.slug);
    expect(visible).not.toHaveProperty("searchText");
  });
});
