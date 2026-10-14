import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "../../database/test-db";
import type { SessionUser } from "@/lib/rbac";

const db = await getTestDb();

if (db === null) {
  console.warn("[manuscript-screening.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

let createdManuscriptIds: string[] = [];
let createdUserIds: string[] = [];

describe.skipIf(db === null)("manuscript screening service", () => {
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
      data: { email, name: "Test", roles: { create: roles.map((r) => ({ role: r })) }, emailVerifiedAt: new Date(), isActive: true },
    });
    createdUserIds.push(u.id);
    return { id: u.id, dbId: u.id, roles, isActive: true };
  }

  async function makeManuscript(submittedById: string, submitterEmail: string, opts?: { status?: string }) {
    const ms = await db!.manuscript.create({
      data: {
        title: "Test Manuscript",
        abstract: "Abstract",
        keywords: ["a"],
        status: (opts?.status ?? "SUBMITTED") as any,
        submittedById,
        reference: `MS-2026-SCR${Date.now().toString().slice(-4)}`,
        submittedAt: new Date(),
      },
    });
    // Add the submitter as an author so COI can be detected by email
    await db!.manuscriptAuthor.create({
      data: {
        manuscriptId: ms.id,
        name: "Test Author",
        email: submitterEmail,
        isCorresponding: true,
        order: 0,
      },
    });
    createdManuscriptIds.push(ms.id);
    return ms;
  }

  it("listManuscripts: COI manuscript never appears for conflicted user", async () => {
    const { listManuscripts } = await import("@/server/services/manuscript-screening");
    const eic = await makeUser("scr-eic-coi@example.com", ["JOURNAL_EDITOR_IN_CHIEF"]);
    // Make a manuscript where eic is the submitter (COI)
    const ms = await makeManuscript(eic.id, "scr-eic-coi@example.com");

    const results = await listManuscripts(db!, eic);
    const found = results.find((r) => r.id === ms.id);
    expect(found).toBeUndefined();
  });

  it("listManuscripts: HOD sees list with hasActions false", async () => {
    const { listManuscripts } = await import("@/server/services/manuscript-screening");
    const author = await makeUser("scr-hod-author@example.com", ["AUTHOR"]);
    const hod = await makeUser("scr-hod@example.com", ["HOD"]);
    await makeManuscript(author.id, "scr-hod-author@example.com");

    const results = await listManuscripts(db!, hod);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.hasActions === false)).toBe(true);
  });

  it("deskReject: non-handling JOURNAL_EDITOR returns error", async () => {
    const { deskReject } = await import("@/server/services/manuscript-screening");
    const author = await makeUser("scr-dr-author@example.com", ["AUTHOR"]);
    const handlingEditor = await makeUser("scr-dr-handling@example.com", ["JOURNAL_EDITOR"]);
    const otherEditor = await makeUser("scr-dr-other@example.com", ["JOURNAL_EDITOR"]);
    const ms = await makeManuscript(author.id, "scr-dr-author@example.com", { status: "SCREENING" });
    await db!.manuscript.update({ where: { id: ms.id }, data: { handlingEditorId: handlingEditor.id } });

    await expect(
      deskReject(db!, otherEditor, ms.id, "Not in scope"),
    ).rejects.toThrow(/unauthorized|forbidden|only/i);
  });

  it("HOD: deskReject action throws Unauthorized", async () => {
    const { deskReject } = await import("@/server/services/manuscript-screening");
    const author = await makeUser("scr-hod-dr-author@example.com", ["AUTHOR"]);
    const hod = await makeUser("scr-hod-dr@example.com", ["HOD"]);
    const ms = await makeManuscript(author.id, "scr-hod-dr-author@example.com", { status: "SCREENING" });

    await expect(
      deskReject(db!, hod, ms.id, "Not in scope"),
    ).rejects.toThrow(/unauthorized|forbidden|only/i);
  });

  it("getManuscriptDetail: COI user throws not found", async () => {
    const { getManuscriptDetail } = await import("@/server/services/manuscript-screening");
    const eic = await makeUser("scr-detail-coi-eic@example.com", ["JOURNAL_EDITOR_IN_CHIEF"]);
    const ms = await makeManuscript(eic.id, "scr-detail-coi-eic@example.com");

    await expect(
      getManuscriptDetail(db!, eic, ms.id),
    ).rejects.toThrow(/not found|conflict/i);
  });

  it("assignHandlingEditor: COI editor cannot be assigned", async () => {
    const { assignHandlingEditor } = await import("@/server/services/manuscript-screening");
    const eic = await makeUser("scr-assign-eic@example.com", ["JOURNAL_EDITOR_IN_CHIEF"]);
    const conflictedEditor = await makeUser("scr-assign-conflict@example.com", ["JOURNAL_EDITOR"]);
    // Make the conflicted editor the submitter of this manuscript
    const ms = await makeManuscript(conflictedEditor.id, "scr-assign-conflict@example.com");

    await expect(
      assignHandlingEditor(db!, eic, ms.id, conflictedEditor.id),
    ).rejects.toThrow(/conflict|COI/i);
  });

  it("listManuscripts: COI detection is case-insensitive (mixed-case email matches lowercase author)", async () => {
    const { listManuscripts } = await import("@/server/services/manuscript-screening");
    // Editor's verified email stored with mixed case in users table
    const editor = await makeUser("Mixed.Case@Example.COM", ["JOURNAL_EDITOR_IN_CHIEF"]);
    // A different user submits, but lists the editor as an author with lowercase email
    const submitter = await makeUser("scr-coi-case-submitter@example.com", ["AUTHOR"]);
    const ms = await makeManuscript(submitter.id, "scr-coi-case-submitter@example.com");
    // Add editor as an author with lowercase version of their email
    await db!.manuscriptAuthor.create({
      data: {
        manuscriptId: ms.id,
        name: "Mixed Case Editor",
        email: "mixed.case@example.com",
        isCorresponding: false,
        order: 1,
      },
    });

    const results = await listManuscripts(db!, editor);
    const found = results.find((r) => r.id === ms.id);
    expect(found, "COI manuscript must be hidden even when email casing differs").toBeUndefined();
  });

  it("addInternalNote: creates ManuscriptEvent with visibleToAuthor false", async () => {
    const { addInternalNote } = await import("@/server/services/manuscript-screening");
    const author = await makeUser("scr-note-author@example.com", ["AUTHOR"]);
    const eic = await makeUser("scr-note-eic@example.com", ["JOURNAL_EDITOR_IN_CHIEF"]);
    const ms = await makeManuscript(author.id, "scr-note-author@example.com");

    await addInternalNote(db!, eic, ms.id, "Internal note text");

    const events = await db!.manuscriptEvent.findMany({
      where: { manuscriptId: ms.id, type: "INTERNAL_NOTE" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.visibleToAuthor).toBe(false);
  });
});
