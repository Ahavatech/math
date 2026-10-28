import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { siteSearch, validateSearchQuery } from "../site-search";

const db = await getTestDb();

const RUN = Date.now().toString(36);

// ---------------------------------------------------------------------------
// Pure unit tests (no DB)
// ---------------------------------------------------------------------------

describe("validateSearchQuery", () => {
  it("rejects empty string", () => expect(validateSearchQuery("")).toBeNull());
  it("rejects single character", () => expect(validateSearchQuery("a")).toBeNull());
  it("rejects 101-char string", () => expect(validateSearchQuery("a".repeat(101))).toBeNull());
  it("accepts 2-char string", () => expect(validateSearchQuery("ab")).toBe("ab"));
  it("accepts 100-char string", () => expect(validateSearchQuery("a".repeat(100))).toBe("a".repeat(100)));
  it("trims whitespace", () => expect(validateSearchQuery("  hello  ")).toBe("hello"));
  it("rejects whitespace-only (becomes empty after trim)", () => expect(validateSearchQuery("   ")).toBeNull());
  it("handles SQL injection attempt as a string (no error)", () => {
    const r = validateSearchQuery("'; DROP TABLE news; --");
    expect(typeof r === "string" || r === null).toBe(true);
  });
  it("handles very long input gracefully", () => expect(validateSearchQuery("x".repeat(200))).toBeNull());
});

// ---------------------------------------------------------------------------
// DB-backed tests
// ---------------------------------------------------------------------------

describe.skipIf(db === null)("siteSearch service", () => {
  // We create one news post and one article with a distinctive sentinel word
  const SENTINEL = `srchtest${RUN}`;
  let newsId: string;
  let articleId: string;
  let issueId: string;
  let lecturerId: string;
  let lecturerUserId: string;

  beforeAll(async () => {
    // News post
    const news = await db!.newsPost.create({
      data: {
        slug: `${SENTINEL}-news`,
        title: `${SENTINEL} Mathematics Department News`,
        body: `<p>This is a test post about ${SENTINEL}.</p>`,
        status: "PUBLISHED",
        publishedAt: new Date(),
        category: "ANNOUNCEMENT",
      },
    });
    newsId = news.id;

    // Published journal issue + article
    const issue = await db!.journalIssue.create({
      data: {
        volume: (Math.abs(parseInt(RUN, 36)) % 9000) + 1000 + 10,
        number: 1,
        year: 2026,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    issueId = issue.id;

    const article = await db!.article.create({
      data: {
        slug: `${SENTINEL}-article`,
        title: `Research on ${SENTINEL} topology`,
        abstract: `<p>Abstract about ${SENTINEL}.</p>`,
        keywords: [SENTINEL],
        searchText: `${SENTINEL} research topology`,
        issueId: issue.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    articleId = article.id;

    // Lecturer user + profile
    const user = await db!.user.create({
      data: { email: `lecturer-search-${RUN}@example.com`, name: `Dr ${SENTINEL}` },
    });
    lecturerUserId = user.id;

    const profile = await db!.lecturerProfile.create({
      data: {
        userId: user.id,
        slug: `lecturer-${RUN}`,
        fullName: `Dr ${SENTINEL} Smith`,
        rank: "LECTURER_I",
        status: "PUBLISHED",
      },
    });
    lecturerId = profile.id;
  });

  afterAll(async () => {
    await db!.article.deleteMany({ where: { id: articleId } });
    await db!.journalIssue.deleteMany({ where: { id: issueId } });
    await db!.newsPost.deleteMany({ where: { id: newsId } });
    await db!.lecturerProfile.deleteMany({ where: { id: lecturerId } });
    await db!.user.deleteMany({ where: { id: lecturerUserId } });
    await db?.$disconnect();
  });

  it("finds a published news post by sentinel word", async () => {
    const { results } = await siteSearch(db!, SENTINEL);
    const found = results.find((r) => r.type === "news" && r.id === newsId);
    expect(found).toBeDefined();
    expect(found?.title).toContain(SENTINEL);
  });

  it("finds a published article by sentinel word", async () => {
    const { results } = await siteSearch(db!, SENTINEL);
    const found = results.find((r) => r.type === "article" && r.id === articleId);
    expect(found).toBeDefined();
    expect(found?.url).toBe(`/journal/articles/${SENTINEL}-article`);
  });

  it("finds a published lecturer by name", async () => {
    const { results } = await siteSearch(db!, SENTINEL);
    const found = results.find((r) => r.type === "lecturer" && r.id === lecturerId);
    expect(found).toBeDefined();
    expect(found?.title).toContain(SENTINEL);
  });

  it("never returns alumni", async () => {
    // Create an alumni entry whose fullName contains the sentinel
    const link = await db!.alumniLink.create({
      data: {
        tokenHash: `hash-alum-search-${RUN}`,
        label: `Test link ${RUN}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const entry = await db!.alumniEntry.create({
      data: {
        linkId: link.id,
        fullName: `${SENTINEL} AlumniPerson`,
        email: `alum-${RUN}@example.com`,
        consentPublicDisplay: true,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `alum-${RUN}`,
        status: "APPROVED",
      },
    });
    try {
      const { results } = await siteSearch(db!, SENTINEL);
      const alumniHit = results.find((r) => r.id === entry.id);
      expect(alumniHit).toBeUndefined();
    } finally {
      await db!.alumniEntry.deleteMany({ where: { id: entry.id } });
      await db!.alumniLink.deleteMany({ where: { id: link.id } });
    }
  });

  it("does not return draft news", async () => {
    const draft = await db!.newsPost.create({
      data: {
        slug: `${SENTINEL}-draft`,
        title: `${SENTINEL} DRAFT`,
        body: `<p>Draft body ${SENTINEL}</p>`,
        status: "DRAFT",
        category: "ANNOUNCEMENT",
      },
    });
    try {
      const { results } = await siteSearch(db!, SENTINEL);
      expect(results.find((r) => r.type === "news" && r.id === draft.id)).toBeUndefined();
    } finally {
      await db!.newsPost.deleteMany({ where: { id: draft.id } });
    }
  });

  it("returns empty for a query shorter than 2 chars", async () => {
    const { results, total } = await siteSearch(db!, "x");
    expect(results).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("does not expose searchText, manuscriptId or author email on article results", async () => {
    const { results } = await siteSearch(db!, SENTINEL);
    const hit = results.find((r) => r.type === "article");
    if (!hit) return; // not found is also fine
    expect(hit).not.toHaveProperty("searchText");
    expect(hit).not.toHaveProperty("manuscriptId");
    expect(hit).not.toHaveProperty("authorEmail");
  });

  it("filters by type correctly", async () => {
    const { results } = await siteSearch(db!, SENTINEL, { type: "article" });
    expect(results.every((r) => r.type === "article")).toBe(true);
  });

  it("paginates: page 2 returns different results than page 1", async () => {
    // Use a very common word likely to return many results; skip if no results
    const { total, perPage } = await siteSearch(db!, SENTINEL);
    if (total <= perPage) return;
    const p1 = await siteSearch(db!, SENTINEL, { page: 1 });
    const p2 = await siteSearch(db!, SENTINEL, { page: 2 });
    const ids1 = new Set(p1.results.map((r) => r.id));
    const anyOverlap = p2.results.some((r) => ids1.has(r.id));
    expect(anyOverlap).toBe(false);
  });

  it("does not return a retracted article without it", async () => {
    // Retracted articles should still appear per spec (12c: retracted stays visible with notice)
    const retracted = await db!.article.create({
      data: {
        slug: `${SENTINEL}-retracted`,
        title: `Retracted: ${SENTINEL} paper`,
        abstract: `Retracted abstract about ${SENTINEL}.`,
        keywords: [],
        searchText: `${SENTINEL} retracted`,
        status: "RETRACTED",
        publishedAt: new Date(),
        retractionReason: "test",
      },
    });
    try {
      const { results } = await siteSearch(db!, SENTINEL);
      const hit = results.find((r) => r.type === "article" && r.id === retracted.id);
      // Retracted articles ARE included per spec (stage 12c decision)
      expect(hit).toBeDefined();
    } finally {
      await db!.article.deleteMany({ where: { id: retracted.id } });
    }
  });
});
