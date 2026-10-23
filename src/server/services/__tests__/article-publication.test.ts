import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  prepareArticleFromManuscript,
  validateArticleForPublication,
  publishArticle,
  scheduleArticle,
  unpublishArticle,
  correctArticle,
  retractArticle,
  listAcknowledgedReviewers,
} from "@/server/services/article-publication";
import type { SessionUser } from "@/lib/rbac";
import { randomUUID } from "node:crypto";
import { ArticleStatus } from "@prisma/client";

const db = await getTestDb();

function makeEiC(id: string, email: string): SessionUser {
  return { id, name: "EiC", email, roles: ["JOURNAL_EDITOR_IN_CHIEF"], isActive: true };
}
function makeEditor(id: string, email: string): SessionUser {
  return { id, name: "Editor", email, roles: ["JOURNAL_EDITOR"], isActive: true };
}
function makeHOD(id: string): SessionUser {
  return { id, name: "HOD", email: "hod@test.com", roles: ["HOD"], isActive: true };
}
function makeAdmin(id: string): SessionUser {
  return { id, name: "Admin", email: "admin@test.com", roles: ["ADMIN"], isActive: true };
}

async function createAcceptedManuscript(db: NonNullable<Awaited<ReturnType<typeof getTestDb>>>, runId: string) {
  const user = await db.user.create({
    data: { id: `u-ap-${runId}`, email: `u-ap-${runId}@test.com`, name: "Author" },
  });
  const ms = await db.manuscript.create({
    data: {
      id: `ms-ap-${runId}`,
      title: "Test Article Title",
      abstract: "Test abstract.",
      keywords: ["math"],
      submittedById: user.id,
      status: "ACCEPTED",
    },
  });
  return { user, ms };
}

async function createEiC(db: NonNullable<Awaited<ReturnType<typeof getTestDb>>>, runId: string) {
  const eic = await db.user.create({
    data: { id: `eic-ap-${runId}`, email: `eic-ap-${runId}@test.com`, name: "EiC" },
  });
  await db.userRole.create({ data: { userId: eic.id, role: "JOURNAL_EDITOR_IN_CHIEF" } });
  return eic;
}

/** Creates an article in DRAFT with pdf and authors for publish tests */
async function createPublishableArticle(db: NonNullable<Awaited<ReturnType<typeof getTestDb>>>, runId: string) {
  const eic = await createEiC(db, runId);
  const { ms, user } = await createAcceptedManuscript(db, runId);
  const actor = makeEiC(eic.id, `eic-ap-${runId}@test.com`);

  const result = await prepareArticleFromManuscript(db, actor, ms.id);
  if (!result.ok) throw new Error(`prepareArticleFromManuscript failed: ${result.reason}`);

  const articleId = result.articleId;

  // Add a fake pdf download record
  const pdf = await db.download.create({
    data: {
      title: "article.pdf",
      category: "journal",
      fileUrl: `https://cdn.test/article-${runId}.pdf`,
      status: "PUBLISHED",
    },
  });
  // Add an author
  await db.articleAuthor.create({
    data: { articleId, name: "Author One", order: 1 },
  });
  // Set license and link pdf
  await db.article.update({
    where: { id: articleId },
    data: { license: "CC BY 4.0", pdfDownloadId: pdf.id },
  });

  return { articleId, actor, eic, ms, user };
}

describe.skipIf(db === null)("article-publication service", () => {
  let runId: string;

  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  // ---------------------------------------------------------------------------
  // Prepare
  // ---------------------------------------------------------------------------

  it("prepareArticleFromManuscript creates a DRAFT article from an ACCEPTED manuscript", async () => {
    const eic = await createEiC(db!, runId);
    const { ms } = await createAcceptedManuscript(db!, runId);
    const actor = makeEiC(eic.id, `eic-ap-${runId}@test.com`);

    const result = await prepareArticleFromManuscript(db!, actor, ms.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const article = await db!.article.findUnique({ where: { id: result.articleId } });
    expect(article).not.toBeNull();
    expect(article!.status).toBe(ArticleStatus.DRAFT);
    expect(article!.title).toBe("Test Article Title");
    expect(article!.manuscriptId).toBe(ms.id);
  });

  it("prepareArticleFromManuscript rejects non-ACCEPTED manuscripts", async () => {
    const eic = await createEiC(db!, runId);
    const user = await db!.user.create({ data: { id: `u-np-${runId}`, email: `u-np-${runId}@test.com`, name: "A" } });
    const ms = await db!.manuscript.create({
      data: { id: `ms-np-${runId}`, title: "T", abstract: "A", keywords: [], submittedById: user.id, status: "UNDER_REVIEW" },
    });
    const result = await prepareArticleFromManuscript(db!, makeEiC(eic.id, `eic-ap-${runId}@test.com`), ms.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/ACCEPTED/);
  });

  it("prepareArticleFromManuscript blocks duplicate article", async () => {
    const eic = await createEiC(db!, runId);
    const { ms } = await createAcceptedManuscript(db!, runId);
    const actor = makeEiC(eic.id, `eic-ap-${runId}@test.com`);
    await prepareArticleFromManuscript(db!, actor, ms.id);
    const second = await prepareArticleFromManuscript(db!, actor, ms.id);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/already exists/);
  });

  it("JOURNAL_EDITOR cannot prepare an article", async () => {
    const editor = await db!.user.create({ data: { id: `ed-ap-${runId}`, email: `ed-ap-${runId}@test.com`, name: "Ed" } });
    const { ms } = await createAcceptedManuscript(db!, runId);
    const result = await prepareArticleFromManuscript(db!, makeEditor(editor.id, `ed-ap-${runId}@test.com`), ms.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/EiC/);
  });

  it("COI: EiC cannot prepare their own submission", async () => {
    const eic = await createEiC(db!, runId);
    // Manuscript submitted BY the EiC
    const ms = await db!.manuscript.create({
      data: { id: `ms-coi-${runId}`, title: "T", abstract: "A", keywords: [], submittedById: eic.id, status: "ACCEPTED" },
    });
    const result = await prepareArticleFromManuscript(db!, makeEiC(eic.id, `eic-ap-${runId}@test.com`), ms.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/[Cc]onflict/);
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("validateArticleForPublication reports missing fields", async () => {
    const eic = await createEiC(db!, runId);
    const { ms } = await createAcceptedManuscript(db!, runId);
    const actor = makeEiC(eic.id, `eic-ap-${runId}@test.com`);
    const prep = await prepareArticleFromManuscript(db!, actor, ms.id);
    if (!prep.ok) throw new Error("prep failed");

    const result = await validateArticleForPublication(db!, prep.articleId);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missing).toContain("At least one author");
      expect(result.missing).toContain("Final PDF uploaded and verified");
      expect(result.missing).toContain("Licence");
    }
  });

  it("validateArticleForPublication returns valid when all fields present", async () => {
    const { articleId } = await createPublishableArticle(db!, runId);
    const result = await validateArticleForPublication(db!, articleId);
    expect(result.valid).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Publish state machine
  // ---------------------------------------------------------------------------

  it("publishArticle transitions DRAFT article to PUBLISHED and marks manuscript PUBLISHED", async () => {
    const { articleId, actor, ms } = await createPublishableArticle(db!, runId);

    const result = await publishArticle(db!, actor, articleId);
    expect(result.ok).toBe(true);

    const article = await db!.article.findUnique({ where: { id: articleId } });
    expect(article!.status).toBe(ArticleStatus.PUBLISHED);
    expect(article!.publishedAt).not.toBeNull();

    const manuscript = await db!.manuscript.findUnique({ where: { id: ms.id } });
    expect(manuscript!.status).toBe("PUBLISHED");
  });

  it("publishArticle creates a PUBLISHED ManuscriptEvent", async () => {
    const { articleId, actor, ms } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);

    const event = await db!.manuscriptEvent.findFirst({
      where: { manuscriptId: ms.id, type: "PUBLISHED" },
    });
    expect(event).not.toBeNull();
    expect(event!.visibleToAuthor).toBe(true);
  });

  it("publishArticle is idempotent-safe: cannot publish twice", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);
    const second = await publishArticle(db!, actor, articleId);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toMatch(/status PUBLISHED/);
  });

  it("HOD cannot publish an article", async () => {
    const { articleId } = await createPublishableArticle(db!, runId);
    const result = await publishArticle(db!, makeHOD(`hod-${runId}`), articleId);
    expect(result.ok).toBe(false);
  });

  it("ADMIN cannot publish an article", async () => {
    const { articleId } = await createPublishableArticle(db!, runId);
    const result = await publishArticle(db!, makeAdmin(`adm-${runId}`), articleId);
    expect(result.ok).toBe(false);
  });

  it("COI: EiC cannot publish their own manuscript's article", async () => {
    const eic = await createEiC(db!, runId);
    // manuscript submitted by the EiC
    const ms = await db!.manuscript.create({
      data: { id: `ms-pcoi-${runId}`, title: "T", abstract: "A", keywords: [], submittedById: eic.id, status: "ACCEPTED" },
    });
    // Create article manually (bypass prepare COI check)
    const pdf = await db!.download.create({
      data: { title: "pdf", category: "journal", fileUrl: "https://cdn.test/a.pdf", status: "PUBLISHED" },
    });
    const article = await db!.article.create({
      data: {
        slug: `coi-pub-${runId}`,
        title: "T",
        abstract: "A",
        keywords: [],
        searchText: "T A",
        type: "RESEARCH_ARTICLE",
        status: ArticleStatus.DRAFT,
        manuscriptId: ms.id,
        license: "CC BY 4.0",
        pdfDownloadId: pdf.id,
      },
    });
    await db!.articleAuthor.create({ data: { articleId: article.id, name: "X", order: 1 } });

    const result = await publishArticle(db!, makeEiC(eic.id, `eic-ap-${runId}@test.com`), article.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/[Cc]onflict/);
  });

  it("snapshot independence: updating manuscript title after publish does not change article title", async () => {
    const { articleId, ms } = await createPublishableArticle(db!, runId);
    const eic = await db!.user.findFirst({ where: { roles: { some: { role: "JOURNAL_EDITOR_IN_CHIEF" } } } });
    const actor = makeEiC(eic!.id, eic!.email);
    await publishArticle(db!, actor, articleId);

    await db!.manuscript.update({ where: { id: ms.id }, data: { title: "CHANGED TITLE" } });

    const article = await db!.article.findUnique({ where: { id: articleId } });
    expect(article!.title).toBe("Test Article Title");
    expect(article!.title).not.toBe("CHANGED TITLE");
  });

  // ---------------------------------------------------------------------------
  // Schedule / Unpublish
  // ---------------------------------------------------------------------------

  it("scheduleArticle sets SCHEDULED status and scheduledFor date", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    const scheduledFor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await scheduleArticle(db!, actor, articleId, scheduledFor);
    expect(result.ok).toBe(true);

    const article = await db!.article.findUnique({ where: { id: articleId } });
    expect(article!.status).toBe(ArticleStatus.SCHEDULED);
    expect(article!.scheduledFor).toEqual(scheduledFor);
  });

  it("unpublishArticle reverts SCHEDULED to DRAFT", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await scheduleArticle(db!, actor, articleId, new Date(Date.now() + 1000));

    const result = await unpublishArticle(db!, actor, articleId);
    expect(result.ok).toBe(true);

    const article = await db!.article.findUnique({ where: { id: articleId } });
    expect(article!.status).toBe(ArticleStatus.DRAFT);
    expect(article!.scheduledFor).toBeNull();
  });

  it("unpublishArticle blocks if article was already published", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);
    const result = await unpublishArticle(db!, actor, articleId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already been published/);
  });

  // ---------------------------------------------------------------------------
  // Correct
  // ---------------------------------------------------------------------------

  it("correctArticle transitions PUBLISHED to CORRECTED and appends notice", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);

    const result = await correctArticle(db!, actor, articleId, "Erratum: figure 2 was mislabelled.");
    expect(result.ok).toBe(true);

    const article = await db!.article.findUnique({ where: { id: articleId } });
    expect(article!.status).toBe(ArticleStatus.CORRECTED);
    expect((article!.notices as string[])[0]).toContain("Erratum");
  });

  it("correctArticle appends multiple notices", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);
    await correctArticle(db!, actor, articleId, "First correction.");
    await correctArticle(db!, actor, articleId, "Second correction.");

    const article = await db!.article.findUnique({ where: { id: articleId } });
    expect((article!.notices as string[]).length).toBe(2);
  });

  it("correctArticle blocks on DRAFT article", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    const result = await correctArticle(db!, actor, articleId, "Notice");
    expect(result.ok).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Retract (page stays visible -- Decision 76)
  // ---------------------------------------------------------------------------

  it("retractArticle transitions PUBLISHED to RETRACTED with reason", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);

    const result = await retractArticle(db!, actor, articleId, "Data integrity concerns.");
    expect(result.ok).toBe(true);

    const article = await db!.article.findUnique({ where: { id: articleId } });
    expect(article!.status).toBe(ArticleStatus.RETRACTED);
    expect(article!.retractionReason).toContain("Data integrity");
  });

  it("retractArticle keeps article in PUBLIC_STATUSES (Decision 76)", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);
    await retractArticle(db!, actor, articleId, "Reason.");

    // Retracted article should be found by public queries (RETRACTED is in PUBLIC_STATUSES)
    const found = await db!.article.findFirst({
      where: { id: articleId, status: { in: ["PUBLISHED", "CORRECTED", "RETRACTED"] } },
    });
    expect(found).not.toBeNull();
    expect(found!.status).toBe(ArticleStatus.RETRACTED);
  });

  it("retractArticle blocks on DRAFT article", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    const result = await retractArticle(db!, actor, articleId, "Reason");
    expect(result.ok).toBe(false);
  });

  it("retractArticle requires a reason", async () => {
    const { articleId, actor } = await createPublishableArticle(db!, runId);
    await publishArticle(db!, actor, articleId);
    const result = await retractArticle(db!, actor, articleId, "   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/reason/i);
  });

  // ---------------------------------------------------------------------------
  // Reviewer acknowledgements
  // ---------------------------------------------------------------------------

  it("listAcknowledgedReviewers returns only opted-in reviewers with a submitted review in the year", async () => {
    const reviewer = await db!.user.create({
      data: { id: `rv-ack-${runId}`, email: `rv-ack-${runId}@test.com`, name: "Opted-in Reviewer", emailVerifiedAt: new Date() },
    });
    await db!.userRole.create({ data: { userId: reviewer.id, role: "REVIEWER" } });
    await db!.reviewerProfile.create({
      data: { userId: reviewer.id, acknowledgementOptIn: true },
    });

    const ms = await db!.manuscript.create({
      data: { id: `ms-ack-${runId}`, title: "T", abstract: "A", keywords: [], status: "PUBLISHED" },
    });
    const round = await db!.manuscriptRound.create({
      data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
    });
    const assignment = await db!.reviewAssignment.create({
      data: { manuscriptId: ms.id, roundId: round.id, reviewerId: reviewer.id, status: "SUBMITTED" },
    });
    await db!.review.create({
      data: {
        assignmentId: assignment.id,
        recommendation: "ACCEPT",
        isDraft: false,
        submittedAt: new Date("2026-06-15"),
      },
    });

    const list = await listAcknowledgedReviewers(db!, 2026);
    expect(list.some((r) => r.name === "Opted-in Reviewer")).toBe(true);
  });

  it("listAcknowledgedReviewers excludes reviewers who did not opt in", async () => {
    const reviewer = await db!.user.create({
      data: { id: `rv-noack-${runId}`, email: `rv-noack-${runId}@test.com`, name: "No-opt Reviewer", emailVerifiedAt: new Date() },
    });
    await db!.userRole.create({ data: { userId: reviewer.id, role: "REVIEWER" } });
    await db!.reviewerProfile.create({
      data: { userId: reviewer.id, acknowledgementOptIn: false },
    });

    const ms = await db!.manuscript.create({
      data: { id: `ms-noack-${runId}`, title: "T", abstract: "A", keywords: [], status: "PUBLISHED" },
    });
    const round = await db!.manuscriptRound.create({
      data: { manuscriptId: ms.id, number: 1, submittedAt: new Date() },
    });
    const assignment = await db!.reviewAssignment.create({
      data: { manuscriptId: ms.id, roundId: round.id, reviewerId: reviewer.id, status: "SUBMITTED" },
    });
    await db!.review.create({
      data: {
        assignmentId: assignment.id,
        recommendation: "ACCEPT",
        isDraft: false,
        submittedAt: new Date("2026-06-15"),
      },
    });

    const list = await listAcknowledgedReviewers(db!, 2026);
    expect(list.some((r) => r.name === "No-opt Reviewer")).toBe(false);
  });
});
