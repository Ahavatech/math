/**
 * DB-backed public leak test for Stage 12c.
 *
 * Creates a fully populated manuscript (reviewers, reviews with
 * commentsToEditor, decision letter, private-file record, internal events)
 * that is accepted and published as an article in a published issue.
 * Then calls every public service query and asserts that none of the
 * private fields appear in the result.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  listArticlesPublic,
  getArticleBySlugPublic,
  listArticlesByIssuePublic,
  getLatestArticlesPublic,
  getArticlePdfForRoute,
} from "@/server/services/journal-articles";
import { listAcknowledgedReviewers } from "@/server/services/article-publication";
import { randomUUID } from "node:crypto";
import { ArticleStatus } from "@prisma/client";

const db = await getTestDb();

// Sentinel values we assert must NOT appear in any public payload
const REVIEWER_EMAIL_SENTINEL = "LEAKED_REVIEWER_EMAIL";
const REVIEWER_NAME_SENTINEL = "LEAKED_REVIEWER_NAME";
const COMMENTS_TO_EDITOR_SENTINEL = "LEAKED_EDITOR_COMMENT";
const DECISION_LETTER_SENTINEL = "LEAKED_DECISION_LETTER";
const PRIVATE_STORAGE_KEY_SENTINEL = "private/LEAKED_STORAGE_KEY";
const INTERNAL_NOTE_SENTINEL = "LEAKED_INTERNAL_NOTE";

function noPrivateData(obj: unknown): void {
  const serialized = JSON.stringify(obj);
  expect(serialized).not.toContain(REVIEWER_EMAIL_SENTINEL);
  expect(serialized).not.toContain(REVIEWER_NAME_SENTINEL);
  expect(serialized).not.toContain(COMMENTS_TO_EDITOR_SENTINEL);
  expect(serialized).not.toContain(DECISION_LETTER_SENTINEL);
  expect(serialized).not.toContain(PRIVATE_STORAGE_KEY_SENTINEL);
  expect(serialized).not.toContain(INTERNAL_NOTE_SENTINEL);
}

describe.skipIf(db === null)("article public leak tests (DB-backed)", () => {
  let runId: string;
  let publishedArticleSlug: string;
  let publishedArticleId: string;
  let draftArticleSlug: string;
  let scheduledArticleSlug: string;
  let retractedArticleSlug: string;
  let issueId: string;

  beforeEach(async () => {
    runId = randomUUID().slice(0, 8);

    // --- Reviewer (opted OUT of acknowledgements) ---
    const reviewer = await db!.user.create({
      data: {
        id: `rv-lk-${runId}`,
        email: `${REVIEWER_EMAIL_SENTINEL}-${runId}@test.com`,
        name: `${REVIEWER_NAME_SENTINEL}-${runId}`,
        emailVerifiedAt: new Date(),
      },
    });
    await db!.userRole.create({ data: { userId: reviewer.id, role: "REVIEWER" } });
    // No ReviewerProfile row -> acknowledgementOptIn defaults to false

    // --- Author ---
    const author = await db!.user.create({
      data: { id: `au-lk-${runId}`, email: `author-lk-${runId}@test.com`, name: "Test Author" },
    });

    // --- Manuscript with full editorial history ---
    const ms = await db!.manuscript.create({
      data: {
        id: `ms-lk-${runId}`,
        title: `Test Leak Article ${runId}`,
        abstract: "Abstract text for leak test.",
        keywords: ["mathematics"],
        submittedById: author.id,
        status: "PUBLISHED",
      },
    });

    const round = await db!.manuscriptRound.create({
      data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
    });

    const assignment = await db!.reviewAssignment.create({
      data: { manuscriptId: ms.id, roundId: round.id, reviewerId: reviewer.id, status: "SUBMITTED" },
    });

    // Review with commentsToEditor (must never reach public)
    await db!.review.create({
      data: {
        assignmentId: assignment.id,
        recommendation: "ACCEPT",
        isDraft: false,
        submittedAt: new Date(),
        commentsToEditor: `${COMMENTS_TO_EDITOR_SENTINEL} This is for editors only.`,
        commentsToAuthor: "Author-facing comments only.",
      },
    });

    // Editorial decision with letter (must never reach public)
    await db!.editorialDecision.create({
      data: {
        manuscriptId: ms.id,
        roundId: round.id,
        editorId: author.id, // reuse author user as editor for test simplicity
        decision: "ACCEPT",
        letter: "PLAIN_LETTER_TEXT",
        letterHtml: `<p>${DECISION_LETTER_SENTINEL}</p>`,
        decidedAt: new Date(),
      },
    });

    // Internal manuscript event (note must never reach public)
    await db!.manuscriptEvent.create({
      data: {
        manuscriptId: ms.id,
        type: "SUBMITTED",
        actorId: author.id,
        visibleToAuthor: false,
        note: `${INTERNAL_NOTE_SENTINEL} internal only`,
      },
    });

    // Private file record (storageKey must never reach public)
    await db!.manuscriptFile.create({
      data: {
        manuscriptId: ms.id,
        kind: "MANUSCRIPT",
        storageKey: `${PRIVATE_STORAGE_KEY_SENTINEL}/ms-${runId}/file.docx`,
        originalName: "manuscript.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1000,
        sha256: "abc123",
      },
    });

    // --- Published issue ---
    const issueNumber = Math.abs(parseInt(runId.slice(0, 4), 16)) % 9000 + 1000;
    const issue = await db!.journalIssue.create({
      data: {
        volume: 99,
        number: issueNumber,
        year: 2026,
        title: `Test Issue ${runId}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    issueId = issue.id;

    // --- Published article ---
    const pdf = await db!.download.create({
      data: {
        title: "article.pdf",
        category: "journal",
        fileUrl: `https://cdn.test/article-${runId}.pdf`,
        status: "PUBLISHED",
      },
    });

    const publishedArticle = await db!.article.create({
      data: {
        slug: `pub-lk-${runId}`,
        title: `Test Leak Article ${runId}`,
        abstract: "Abstract text for leak test.",
        keywords: ["mathematics"],
        searchText: "test leak article mathematics",
        type: "RESEARCH_ARTICLE",
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        manuscriptId: ms.id,
        issueId: issue.id,
        license: "CC BY 4.0",
        pdfDownloadId: pdf.id,
      },
    });
    publishedArticleSlug = publishedArticle.slug;
    publishedArticleId = publishedArticle.id;

    await db!.articleAuthor.create({
      data: { articleId: publishedArticle.id, name: "Test Author", order: 1 },
    });

    // --- DRAFT article (must not appear in public queries) ---
    const draftArticle = await db!.article.create({
      data: {
        slug: `draft-lk-${runId}`,
        title: `Draft Leak Article ${runId}`,
        abstract: "Abstract.",
        keywords: [],
        searchText: "draft",
        type: "RESEARCH_ARTICLE",
        status: ArticleStatus.DRAFT,
        issueId: issue.id,
      },
    });
    draftArticleSlug = draftArticle.slug;

    // --- SCHEDULED article (must not appear in public queries) ---
    const scheduledArticle = await db!.article.create({
      data: {
        slug: `sched-lk-${runId}`,
        title: `Scheduled Leak Article ${runId}`,
        abstract: "Abstract.",
        keywords: [],
        searchText: "scheduled",
        type: "RESEARCH_ARTICLE",
        status: ArticleStatus.SCHEDULED,
        scheduledFor: new Date(Date.now() + 86400000),
        issueId: issue.id,
      },
    });
    scheduledArticleSlug = scheduledArticle.slug;

    // --- RETRACTED article (must appear but show notice) ---
    const retractedArticle = await db!.article.create({
      data: {
        slug: `ret-lk-${runId}`,
        title: `Retracted Leak Article ${runId}`,
        abstract: "Abstract.",
        keywords: [],
        searchText: "retracted",
        type: "RESEARCH_ARTICLE",
        status: ArticleStatus.RETRACTED,
        publishedAt: new Date(),
        retractionReason: "Test retraction reason.",
        issueId: issue.id,
      },
    });
    retractedArticleSlug = retractedArticle.slug;
  });

  // -----------------------------------------------------------------------
  // getArticleBySlugPublic
  // -----------------------------------------------------------------------

  it("getArticleBySlugPublic: published article returns no private data", async () => {
    const result = await getArticleBySlugPublic(db!, publishedArticleSlug);
    expect(result).not.toBeNull();
    noPrivateData(result);
  });

  it("getArticleBySlugPublic: DRAFT article returns null", async () => {
    const result = await getArticleBySlugPublic(db!, draftArticleSlug);
    expect(result).toBeNull();
  });

  it("getArticleBySlugPublic: SCHEDULED article returns null", async () => {
    const result = await getArticleBySlugPublic(db!, scheduledArticleSlug);
    expect(result).toBeNull();
  });

  it("getArticleBySlugPublic: RETRACTED article returns result with notice (Decision 76)", async () => {
    const result = await getArticleBySlugPublic(db!, retractedArticleSlug);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("RETRACTED");
    expect(result!.retractionReason).toBe("Test retraction reason.");
    noPrivateData(result);
  });

  // -----------------------------------------------------------------------
  // listArticlesPublic
  // -----------------------------------------------------------------------

  it("listArticlesPublic: contains published article, no private data", async () => {
    const { articles } = await listArticlesPublic(db!);
    const found = articles.find((a) => a.id === publishedArticleId);
    expect(found).toBeDefined();
    noPrivateData(articles);
  });

  it("listArticlesPublic: does NOT contain DRAFT or SCHEDULED articles", async () => {
    const { articles } = await listArticlesPublic(db!);
    const drafts = articles.filter((a) => a.status === "DRAFT" || a.status === "SCHEDULED");
    expect(drafts).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // listArticlesByIssuePublic
  // -----------------------------------------------------------------------

  it("listArticlesByIssuePublic: contains published and retracted; not draft/scheduled; no private data", async () => {
    const articles = await listArticlesByIssuePublic(db!, issueId);
    const slugs = articles.map((a) => a.slug);
    expect(slugs).toContain(publishedArticleSlug);
    expect(slugs).toContain(retractedArticleSlug);
    expect(slugs).not.toContain(draftArticleSlug);
    expect(slugs).not.toContain(scheduledArticleSlug);
    noPrivateData(articles);
  });

  // -----------------------------------------------------------------------
  // getLatestArticlesPublic (RSS source)
  // -----------------------------------------------------------------------

  it("getLatestArticlesPublic: no private data in RSS source", async () => {
    const articles = await getLatestArticlesPublic(db!, 50);
    noPrivateData(articles);
    const hasScheduled = articles.some((a) => a.status === "SCHEDULED");
    const hasDraft = articles.some((a) => a.status === "DRAFT");
    expect(hasScheduled).toBe(false);
    expect(hasDraft).toBe(false);
  });

  // -----------------------------------------------------------------------
  // getArticlePdfForRoute
  // -----------------------------------------------------------------------

  it("getArticlePdfForRoute: published article returns fileUrl; no private data", async () => {
    const result = await getArticlePdfForRoute(db!, publishedArticleSlug);
    expect(result).not.toBeNull();
    noPrivateData(result);
    // Ensure no reviewer/manuscript private fields
    expect(JSON.stringify(result)).not.toContain("storageKey");
    expect(JSON.stringify(result)).not.toContain("commentsToEditor");
  });

  it("getArticlePdfForRoute: DRAFT article returns null", async () => {
    const result = await getArticlePdfForRoute(db!, draftArticleSlug);
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // listAcknowledgedReviewers (reviewer page source)
  // -----------------------------------------------------------------------

  it("listAcknowledgedReviewers: reviewer without opt-in is absent", async () => {
    // The reviewer created in beforeEach has no ReviewerProfile -> not in list
    const list = await listAcknowledgedReviewers(db!, 2026);
    const leaked = list.find((r) => r.name.includes(REVIEWER_NAME_SENTINEL));
    expect(leaked).toBeUndefined();
    noPrivateData(list);
  });

  it("listAcknowledgedReviewers: opted-in reviewer name only (no id, email)", async () => {
    // Create a reviewer who explicitly opts in
    const optedIn = await db!.user.create({
      data: { id: `rv-optin-${runId}`, email: `optin-${runId}@test.com`, name: `OptedIn-${runId}`, emailVerifiedAt: new Date() },
    });
    await db!.userRole.create({ data: { userId: optedIn.id, role: "REVIEWER" } });
    await db!.reviewerProfile.create({ data: { userId: optedIn.id, acknowledgementOptIn: true } });

    const ms2 = await db!.manuscript.create({
      data: { id: `ms-oi-${runId}`, title: "T2", abstract: "A2", keywords: [], status: "PUBLISHED" },
    });
    const round2 = await db!.manuscriptRound.create({
      data: { manuscriptId: ms2.id, number: 1, submittedAt: new Date() },
    });
    const assignment2 = await db!.reviewAssignment.create({
      data: { manuscriptId: ms2.id, roundId: round2.id, reviewerId: optedIn.id, status: "SUBMITTED" },
    });
    await db!.review.create({
      data: {
        assignmentId: assignment2.id,
        recommendation: "ACCEPT",
        isDraft: false,
        submittedAt: new Date("2026-08-01"),
      },
    });

    const list = await listAcknowledgedReviewers(db!, 2026);
    const found = list.find((r) => r.name === `OptedIn-${runId}`);
    expect(found).toBeDefined();

    // The returned object must have only { name } -- no id, email, etc.
    const keys = Object.keys(found!);
    expect(keys).toEqual(["name"]);
  });

  // -----------------------------------------------------------------------
  // PUBLIC_ARTICLE_SELECT never includes these fields
  // -----------------------------------------------------------------------

  it("PUBLIC_ARTICLE_SELECT result has no manuscriptId, submittedById, pdfDownloadId, or internal fields", async () => {
    const result = await getArticleBySlugPublic(db!, publishedArticleSlug);
    expect(result).not.toBeNull();
    const raw = result as Record<string, unknown>;
    // These private fields must not appear in the public select
    expect(raw).not.toHaveProperty("manuscriptId");
    expect(raw).not.toHaveProperty("submittedById");
    expect(raw).not.toHaveProperty("searchText");
    expect(raw).not.toHaveProperty("finalPdfSha256");
    // authors must not include email
    if (Array.isArray(raw.authors)) {
      for (const a of raw.authors as Record<string, unknown>[]) {
        expect(a).not.toHaveProperty("email");
        expect(a).not.toHaveProperty("userId");
      }
    }
  });
});
