import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "../../database/test-db";

const db = await getTestDb();

if (db === null) {
  console.warn("[author-dashboard.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

const createdManuscriptIds: string[] = [];
const createdUserIds: string[] = [];

describe.skipIf(db === null)("author dashboard service", () => {
  afterEach(async () => {
    if (createdManuscriptIds.length > 0) {
      await db!.manuscriptEvent.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscriptFile.deleteMany({ where: { manuscriptId: { in: createdManuscriptIds } } });
      await db!.manuscript.deleteMany({ where: { id: { in: createdManuscriptIds } } });
      createdManuscriptIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function makeUser(email: string) {
    const u = await db!.user.create({
      data: { email, name: "Test", emailVerifiedAt: new Date(), isActive: true },
    });
    createdUserIds.push(u.id);
    return u;
  }

  async function makeManuscript(userId: string, opts?: { reference?: string; status?: string }) {
    const ms = await db!.manuscript.create({
      data: {
        title: "Test Manuscript",
        abstract: "Abstract",
        keywords: ["a"],
        status: (opts?.status ?? "INCOMPLETE") as import("@prisma/client").ManuscriptStatus,
        submittedById: userId,
        reference: opts?.reference ?? null,
        submittedAt: opts?.reference ? new Date() : null,
      },
    });
    createdManuscriptIds.push(ms.id);
    return ms;
  }

  it("getAuthorManuscripts: returns only user's own manuscripts", async () => {
    const { getAuthorManuscripts } = await import("@/server/services/author-dashboard");
    const userA = await makeUser("dash-owner@example.com");
    const userB = await makeUser("dash-other@example.com");
    await makeManuscript(userA.id);
    await makeManuscript(userB.id);

    const results = await getAuthorManuscripts(db!, userA.id);
    expect(results.every((m) => m.submittedById === userA.id)).toBe(true);
  });

  it("getAuthorManuscriptDetail: returns 404 for another user's manuscript", async () => {
    const { getAuthorManuscriptDetail } = await import("@/server/services/author-dashboard");
    const owner = await makeUser("dash-detail-owner@example.com");
    const other = await makeUser("dash-detail-other@example.com");
    const ms = await makeManuscript(owner.id);

    await expect(
      getAuthorManuscriptDetail(db!, other.id, ms.id),
    ).rejects.toThrow(/not found/i);
  });

  it("getAuthorManuscriptDetail: does not include events with visibleToAuthor false", async () => {
    const { getAuthorManuscriptDetail } = await import("@/server/services/author-dashboard");
    const user = await makeUser("dash-events@example.com");
    const ms = await makeManuscript(user.id);

    await db!.manuscriptEvent.create({
      data: { manuscriptId: ms.id, actorId: user.id, type: "SUBMITTED", visibleToAuthor: false },
    });
    await db!.manuscriptEvent.create({
      data: { manuscriptId: ms.id, actorId: user.id, type: "RESUBMITTED", visibleToAuthor: true },
    });

    const detail = await getAuthorManuscriptDetail(db!, user.id, ms.id);
    expect(detail.events.every((e) => e.visibleToAuthor === true)).toBe(true);
  });

  it("plainLanguageStatus: maps every ManuscriptStatus", async () => {
    const { plainLanguageStatus } = await import("@/server/services/author-dashboard");
    const statuses = [
      "INCOMPLETE",
      "SUBMITTED",
      "SCREENING",
      "RETURNED_TO_AUTHOR",
      "UNDER_REVIEW",
      "REJECTED",
      "WITHDRAWN",
    ] as const;

    for (const s of statuses) {
      const label = plainLanguageStatus(s);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("getAuthorManuscripts: returned summary includes plainLanguageStatus", async () => {
    const { getAuthorManuscripts } = await import("@/server/services/author-dashboard");
    const user = await makeUser("dash-status@example.com");
    await makeManuscript(user.id, { status: "INCOMPLETE" });

    const results = await getAuthorManuscripts(db!, user.id);
    expect(results[0]?.plainLanguageStatus).toBeTruthy();
  });
});
