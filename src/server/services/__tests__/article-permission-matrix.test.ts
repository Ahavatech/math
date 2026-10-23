/**
 * Permission-matrix test for article publication (Stage 12c prompt Section 7).
 *
 * Exactly which roles can prepare, publish, correct and retract — asserted
 * against real service calls (no mocks).
 *
 * Matrix from DECISIONS.md:
 *   Prepare:  SUPER_ADMIN ✓, EiC ✓, EDITOR ✗, HOD ✗, ADMIN ✗
 *   Publish:  SUPER_ADMIN ✓, EiC ✓, EDITOR ✗, HOD ✗, ADMIN ✗
 *   Correct:  SUPER_ADMIN ✓, EiC ✓, EDITOR ✗, HOD ✗, ADMIN ✗
 *   Retract:  SUPER_ADMIN ✓, EiC ✓, EDITOR ✗, HOD ✗, ADMIN ✗
 *   COI:      EiC cannot act on their own submission
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  prepareArticleFromManuscript,
  publishArticle,
  correctArticle,
  retractArticle,
} from "@/server/services/article-publication";
import type { SessionUser } from "@/lib/rbac";
import { randomUUID } from "node:crypto";
import { ArticleStatus } from "@prisma/client";

const db = await getTestDb();

function makeUser(id: string, roles: SessionUser["roles"]): SessionUser {
  return { id, name: "Test", email: `${id}@test.com`, roles, isActive: true };
}

async function upsertUser(id: string) {
  await db!.user.upsert({
    where: { id },
    create: { id, email: `${id}@test.com`, name: "Test" },
    update: {},
  });
}

describe.skipIf(db === null)("article publication permission matrix", () => {
  let runId: string;

  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  // Helper: create an ACCEPTED manuscript
  async function makeManuscript(authorId: string) {
    await db!.user.upsert({
      where: { id: authorId },
      create: { id: authorId, email: `${authorId}@test.com`, name: "Author" },
      update: {},
    });
    return db!.manuscript.create({
      data: {
        id: `ms-pm-${runId}-${authorId.slice(-4)}`,
        title: "Perm Test",
        abstract: "Abstract.",
        keywords: [],
        submittedById: authorId,
        status: "ACCEPTED",
      },
    });
  }

  // Helper: create a publishable article (DRAFT + pdf + author + license)
  async function makePublishableArticle(slug: string) {
    const pdf = await db!.download.create({
      data: { title: "pdf", category: "journal", fileUrl: `https://cdn.test/${slug}.pdf`, status: "PUBLISHED" },
    });
    const article = await db!.article.create({
      data: {
        slug,
        title: "Perm Test",
        abstract: "Abstract.",
        keywords: [],
        searchText: "perm test",
        type: "RESEARCH_ARTICLE",
        status: ArticleStatus.DRAFT,
        license: "CC BY 4.0",
        pdfDownloadId: pdf.id,
      },
    });
    await db!.articleAuthor.create({ data: { articleId: article.id, name: "Author", order: 1 } });
    return article;
  }

  // ---------------------------------------------------------------------------
  // PREPARE
  // ---------------------------------------------------------------------------

  it("SUPER_ADMIN can prepare an article", async () => {
    const authorId = `au-pm-sa-${runId}`;
    const actorId = `actor-sa-${runId}`;
    await upsertUser(actorId);
    const ms = await makeManuscript(authorId);
    const result = await prepareArticleFromManuscript(db!, makeUser(actorId, ["SUPER_ADMIN"]), ms.id);
    expect(result.ok).toBe(true);
  });

  it("EiC can prepare an article", async () => {
    const authorId = `au-pm-eic-${runId}`;
    const actorId = `actor-eic-${runId}`;
    await upsertUser(actorId);
    const ms = await makeManuscript(authorId);
    const result = await prepareArticleFromManuscript(db!, makeUser(actorId, ["JOURNAL_EDITOR_IN_CHIEF"]), ms.id);
    expect(result.ok).toBe(true);
  });

  it("JOURNAL_EDITOR cannot prepare an article", async () => {
    const authorId = `au-pm-ed-${runId}`;
    const ms = await makeManuscript(authorId);
    const actor = makeUser(`actor-ed-${runId}`, ["JOURNAL_EDITOR"]);
    const result = await prepareArticleFromManuscript(db!, actor, ms.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/EiC|SUPER_ADMIN/);
  });

  it("HOD cannot prepare an article", async () => {
    const authorId = `au-pm-hod-${runId}`;
    const ms = await makeManuscript(authorId);
    const actor = makeUser(`actor-hod-${runId}`, ["HOD"]);
    const result = await prepareArticleFromManuscript(db!, actor, ms.id);
    expect(result.ok).toBe(false);
  });

  it("ADMIN cannot prepare an article", async () => {
    const authorId = `au-pm-adm-${runId}`;
    const ms = await makeManuscript(authorId);
    const actor = makeUser(`actor-adm-${runId}`, ["ADMIN"]);
    const result = await prepareArticleFromManuscript(db!, actor, ms.id);
    expect(result.ok).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // PUBLISH
  // ---------------------------------------------------------------------------

  it("SUPER_ADMIN can publish", async () => {
    const actorId = `sa-pub-${runId}`;
    await upsertUser(actorId);
    const article = await makePublishableArticle(`pub-sa-${runId}`);
    const result = await publishArticle(db!, makeUser(actorId, ["SUPER_ADMIN"]), article.id);
    expect(result.ok).toBe(true);
  });

  it("EiC can publish", async () => {
    const actorId = `eic-pub-${runId}`;
    await upsertUser(actorId);
    const article = await makePublishableArticle(`pub-eic-${runId}`);
    const result = await publishArticle(db!, makeUser(actorId, ["JOURNAL_EDITOR_IN_CHIEF"]), article.id);
    expect(result.ok).toBe(true);
  });

  it("JOURNAL_EDITOR cannot publish", async () => {
    const article = await makePublishableArticle(`pub-ed-${runId}`);
    const result = await publishArticle(db!, makeUser(`ed-pub-${runId}`, ["JOURNAL_EDITOR"]), article.id);
    expect(result.ok).toBe(false);
  });

  it("HOD cannot publish", async () => {
    const article = await makePublishableArticle(`pub-hod-${runId}`);
    const result = await publishArticle(db!, makeUser(`hod-pub-${runId}`, ["HOD"]), article.id);
    expect(result.ok).toBe(false);
  });

  it("ADMIN cannot publish", async () => {
    const article = await makePublishableArticle(`pub-adm-${runId}`);
    const result = await publishArticle(db!, makeUser(`adm-pub-${runId}`, ["ADMIN"]), article.id);
    expect(result.ok).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // CORRECT (after publish)
  // ---------------------------------------------------------------------------

  it("SUPER_ADMIN can correct a published article", async () => {
    const saId = `sa-cor-${runId}`;
    await upsertUser(saId);
    const article = await makePublishableArticle(`cor-sa-${runId}`);
    const sa = makeUser(saId, ["SUPER_ADMIN"]);
    await publishArticle(db!, sa, article.id);
    const result = await correctArticle(db!, sa, article.id, "Correction text.");
    expect(result.ok).toBe(true);
  });

  it("EiC can correct a published article", async () => {
    const eicId = `eic-cor-${runId}`;
    await upsertUser(eicId);
    const article = await makePublishableArticle(`cor-eic-${runId}`);
    const eic = makeUser(eicId, ["JOURNAL_EDITOR_IN_CHIEF"]);
    await publishArticle(db!, eic, article.id);
    const result = await correctArticle(db!, eic, article.id, "Correction text.");
    expect(result.ok).toBe(true);
  });

  it("JOURNAL_EDITOR cannot correct", async () => {
    const eicId = `eic-cor2-${runId}`;
    await upsertUser(eicId);
    const article = await makePublishableArticle(`cor-ed-${runId}`);
    const eic = makeUser(eicId, ["JOURNAL_EDITOR_IN_CHIEF"]);
    await publishArticle(db!, eic, article.id);
    const result = await correctArticle(db!, makeUser(`ed-cor-${runId}`, ["JOURNAL_EDITOR"]), article.id, "Notice");
    expect(result.ok).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // RETRACT (after publish)
  // ---------------------------------------------------------------------------

  it("SUPER_ADMIN can retract a published article", async () => {
    const saId = `sa-ret-${runId}`;
    await upsertUser(saId);
    const article = await makePublishableArticle(`ret-sa-${runId}`);
    const sa = makeUser(saId, ["SUPER_ADMIN"]);
    await publishArticle(db!, sa, article.id);
    const result = await retractArticle(db!, sa, article.id, "Retraction reason.");
    expect(result.ok).toBe(true);
  });

  it("EiC can retract a published article", async () => {
    const eicId = `eic-ret-${runId}`;
    await upsertUser(eicId);
    const article = await makePublishableArticle(`ret-eic-${runId}`);
    const eic = makeUser(eicId, ["JOURNAL_EDITOR_IN_CHIEF"]);
    await publishArticle(db!, eic, article.id);
    const result = await retractArticle(db!, eic, article.id, "Retraction reason.");
    expect(result.ok).toBe(true);
  });

  it("JOURNAL_EDITOR cannot retract", async () => {
    const eicId = `eic-ret2-${runId}`;
    await upsertUser(eicId);
    const article = await makePublishableArticle(`ret-ed-${runId}`);
    await publishArticle(db!, makeUser(eicId, ["JOURNAL_EDITOR_IN_CHIEF"]), article.id);
    const result = await retractArticle(db!, makeUser(`ed-ret-${runId}`, ["JOURNAL_EDITOR"]), article.id, "Reason");
    expect(result.ok).toBe(false);
  });

  it("HOD cannot retract", async () => {
    const eicId = `eic-ret3-${runId}`;
    await upsertUser(eicId);
    const article = await makePublishableArticle(`ret-hod-${runId}`);
    await publishArticle(db!, makeUser(eicId, ["JOURNAL_EDITOR_IN_CHIEF"]), article.id);
    const result = await retractArticle(db!, makeUser(`hod-ret-${runId}`, ["HOD"]), article.id, "Reason");
    expect(result.ok).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // COI rule
  // ---------------------------------------------------------------------------

  it("EiC cannot prepare their own submission (COI)", async () => {
    const eicId = `eic-coi-${runId}`;
    await db!.user.upsert({
      where: { id: eicId },
      create: { id: eicId, email: `${eicId}@test.com`, name: "EiC" },
      update: {},
    });
    const ms = await db!.manuscript.create({
      data: {
        id: `ms-coi-${runId}`,
        title: "COI Test",
        abstract: "Abstract.",
        keywords: [],
        submittedById: eicId,
        status: "ACCEPTED",
      },
    });
    const result = await prepareArticleFromManuscript(db!, makeUser(eicId, ["JOURNAL_EDITOR_IN_CHIEF"]), ms.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/[Cc]onflict/);
  });
});
