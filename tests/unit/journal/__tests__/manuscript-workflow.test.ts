import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "../../database/test-db";
import type { SessionUser } from "@/lib/rbac";

const db = await getTestDb();

if (db === null) {
  console.warn("[manuscript-workflow.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

const createdManuscriptIds: string[] = [];
const createdUserIds: string[] = [];

describe.skipIf(db === null)("manuscript state machine", () => {
  afterEach(async () => {
    if (createdManuscriptIds.length > 0) {
      await db!.editorialDecision.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptEvent.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptRound.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptAuthor.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptFile.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscript.deleteMany({ where: { id: { in: createdManuscriptIds } } });
      createdManuscriptIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await db!.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db!.journalCounter.deleteMany({ where: {} });
      await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function makeUser(email: string, roles: SessionUser["roles"]): Promise<SessionUser & { dbId: string }> {
    const u = await db!.user.create({
      data: { email, name: "Test User", roles: { create: roles.map((r) => ({ role: r })) }, emailVerifiedAt: new Date(), isActive: true },
    });
    createdUserIds.push(u.id);
    return { id: u.id, dbId: u.id, roles, isActive: true };
  }

  async function makeManuscript(submittedById: string, status: string) {
    const ms = await db!.manuscript.create({
      data: {
        title: "Test Manuscript",
        abstract: "Abstract",
        keywords: ["a", "b", "c"],
        status: status as import("@prisma/client").ManuscriptStatus,
        submittedById,
        reference: status !== "INCOMPLETE" ? `MS-2026-${Date.now().toString().slice(-4)}` : null,
        submittedAt: status !== "INCOMPLETE" ? new Date() : null,
      },
    });
    createdManuscriptIds.push(ms.id);
    return ms;
  }

  it("ASSIGN_EDITOR: SUBMITTED → SCREENING by EiC", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-assign@example.com", ["AUTHOR"]);
    const eic = await makeUser("wf-eic-assign@example.com", ["JOURNAL_EDITOR_IN_CHIEF"]);
    const editor = await makeUser("wf-editor-assign@example.com", ["JOURNAL_EDITOR"]);
    const ms = await makeManuscript(author.id, "SUBMITTED");

    const result = await transition(db!, eic, ms.id, "ASSIGN_EDITOR", { handlingEditorId: editor.id });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.newStatus).toBe("SCREENING");

    const updated = await db!.manuscript.findUnique({ where: { id: ms.id } });
    expect(updated!.handlingEditorId).toBe(editor.id);
  });

  it("RETURN_TO_AUTHOR: SCREENING → RETURNED_TO_AUTHOR by handling editor", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-return@example.com", ["AUTHOR"]);
    const editor = await makeUser("wf-editor-return@example.com", ["JOURNAL_EDITOR"]);
    const ms = await makeManuscript(author.id, "SCREENING");
    await db!.manuscript.update({ where: { id: ms.id }, data: { handlingEditorId: editor.id } });

    const result = await transition(db!, editor, ms.id, "RETURN_TO_AUTHOR", { note: "Fix your refs" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.newStatus).toBe("RETURNED_TO_AUTHOR");
  });

  it("RESUBMIT: RETURNED_TO_AUTHOR → SCREENING by author", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-resubmit@example.com", ["AUTHOR"]);
    const ms = await makeManuscript(author.id, "RETURNED_TO_AUTHOR");

    const result = await transition(db!, author, ms.id, "RESUBMIT");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.newStatus).toBe("SCREENING");
  });

  it("DESK_REJECT: SCREENING → REJECTED by EiC", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-dreject@example.com", ["AUTHOR"]);
    const eic = await makeUser("wf-eic-dreject@example.com", ["JOURNAL_EDITOR_IN_CHIEF"]);
    const ms = await makeManuscript(author.id, "SCREENING");

    const result = await transition(db!, eic, ms.id, "DESK_REJECT", { letter: "Not in scope." });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.newStatus).toBe("REJECTED");
  });

  it("DESK_REJECT: SCREENING → REJECTED by handling editor", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-dreject2@example.com", ["AUTHOR"]);
    const editor = await makeUser("wf-editor-dreject2@example.com", ["JOURNAL_EDITOR"]);
    const ms = await makeManuscript(author.id, "SCREENING");
    await db!.manuscript.update({ where: { id: ms.id }, data: { handlingEditorId: editor.id } });

    const result = await transition(db!, editor, ms.id, "DESK_REJECT", { letter: "Not in scope." });
    expect(result.ok).toBe(true);
  });

  it("APPROVE_FOR_REVIEW: SUBMITTED → UNDER_REVIEW by EiC", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-approve@example.com", ["AUTHOR"]);
    const eic = await makeUser("wf-eic-approve@example.com", ["JOURNAL_EDITOR_IN_CHIEF"]);
    const ms = await makeManuscript(author.id, "SUBMITTED");

    const result = await transition(db!, eic, ms.id, "APPROVE_FOR_REVIEW");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.newStatus).toBe("UNDER_REVIEW");
  });

  it("WITHDRAW: SUBMITTED → WITHDRAWN by owner", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-withdraw@example.com", ["AUTHOR"]);
    const ms = await makeManuscript(author.id, "SUBMITTED");

    const result = await transition(db!, author, ms.id, "WITHDRAW");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.newStatus).toBe("WITHDRAWN");
  });

  it("WITHDRAW: INCOMPLETE → manuscript deleted by owner", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-deletedraft@example.com", ["AUTHOR"]);
    const ms = await makeManuscript(author.id, "INCOMPLETE");

    const result = await transition(db!, author, ms.id, "WITHDRAW");
    expect(result.ok).toBe(true);

    // Manuscript should be deleted
    const deleted = await db!.manuscript.findUnique({ where: { id: ms.id } });
    expect(deleted).toBeNull();
    // Don't track this as needing cleanup
    createdManuscriptIds.splice(createdManuscriptIds.indexOf(ms.id), 1);
  });

  it("SUBMIT from SUBMITTED returns error", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-double-submit@example.com", ["AUTHOR"]);
    const ms = await makeManuscript(author.id, "SUBMITTED");

    const result = await transition(db!, author, ms.id, "SUBMIT");
    expect(result.ok).toBe(false);
  });

  it("DESK_REJECT by non-handling JOURNAL_EDITOR returns error", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-nodreject@example.com", ["AUTHOR"]);
    const handlingEditor = await makeUser("wf-handling-editor@example.com", ["JOURNAL_EDITOR"]);
    const otherEditor = await makeUser("wf-other-editor@example.com", ["JOURNAL_EDITOR"]);
    const ms = await makeManuscript(author.id, "SCREENING");
    await db!.manuscript.update({ where: { id: ms.id }, data: { handlingEditorId: handlingEditor.id } });

    // A different editor (not the handling editor) attempts DESK_REJECT
    const result = await transition(db!, otherEditor, ms.id, "DESK_REJECT");
    expect(result.ok).toBe(false);
  });

  it("DESK_REJECT by HOD returns error", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-hod-dreject@example.com", ["AUTHOR"]);
    const hod = await makeUser("wf-hod-dreject@example.com", ["HOD"]);
    const ms = await makeManuscript(author.id, "SCREENING");

    const result = await transition(db!, hod, ms.id, "DESK_REJECT");
    expect(result.ok).toBe(false);
  });

  it("APPROVE_FOR_REVIEW by ADMIN returns error", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-admin-approve@example.com", ["AUTHOR"]);
    const admin = await makeUser("wf-admin-approve@example.com", ["ADMIN"]);
    const ms = await makeManuscript(author.id, "SUBMITTED");

    const result = await transition(db!, admin, ms.id, "APPROVE_FOR_REVIEW");
    expect(result.ok).toBe(false);
  });

  it("WITHDRAW from UNDER_REVIEW returns error", async () => {
    const { transition } = await import("@/server/services/manuscript-workflow");
    const author = await makeUser("wf-author-under-review@example.com", ["AUTHOR"]);
    const ms = await makeManuscript(author.id, "UNDER_REVIEW");

    const result = await transition(db!, author, ms.id, "WITHDRAW");
    expect(result.ok).toBe(false);
  });
});
