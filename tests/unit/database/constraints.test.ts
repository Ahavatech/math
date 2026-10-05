import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "./test-db";

const db = await getTestDb();

if (db === null) {
  console.warn(
    "[tests/unit/database/constraints.test.ts] skipped: no reachable TEST_DATABASE_URL",
  );
}

/**
 * Tracks exactly what each test creates, so afterEach can clean up only
 * those rows. TEST_DATABASE_URL is a shared database that seed.test.ts
 * also writes to, and Vitest runs test files in parallel by default, so
 * a blanket deleteMany() here would race with (and wipe) the other
 * file's seeded rows instead of just this file's own fixtures.
 */
let createdUserIds: string[] = [];
let createdProgrammeIds: string[] = [];
let createdManuscriptIds: string[] = [];

describe.skipIf(db === null)("relational constraints", () => {
  afterEach(async () => {
    // Children before parents; restricted deletes must clear the rows
    // that reference them first.
    await db!.reviewAssignment.deleteMany({
      where: { manuscriptId: { in: createdManuscriptIds } },
    });
    await db!.editorialDecision.deleteMany({
      where: { manuscriptId: { in: createdManuscriptIds } },
    });
    await db!.manuscriptRound.deleteMany({
      where: { manuscriptId: { in: createdManuscriptIds } },
    });
    await db!.manuscript.deleteMany({
      where: { id: { in: createdManuscriptIds } },
    });
    await db!.userToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await db!.userRole.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await db!.programme.deleteMany({
      where: { id: { in: createdProgrammeIds } },
    });

    createdUserIds = [];
    createdProgrammeIds = [];
    createdManuscriptIds = [];
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("rejects a duplicate (userId, role) pair but allows a second distinct role", async () => {
    const user = await db!.user.create({
      data: { email: "constraints-role@example.com", name: "Test User" },
    });
    createdUserIds.push(user.id);

    await db!.userRole.create({ data: { userId: user.id, role: "LECTURER" } });

    await expect(
      db!.userRole.create({ data: { userId: user.id, role: "LECTURER" } }),
    ).rejects.toThrow();

    await expect(
      db!.userRole.create({ data: { userId: user.id, role: "ADMIN" } }),
    ).resolves.toBeDefined();

    const roles = await db!.userRole.findMany({ where: { userId: user.id } });
    expect(roles).toHaveLength(2);
  });

  it("rejects a duplicate slug on a public entity", async () => {
    const programme = await db!.programme.create({
      data: {
        slug: "duplicate-slug-test",
        level: "BSC",
        title: "First",
        summary: "s",
        body: "b",
        duration: "4 years",
        admissionRequirements: "r",
      },
    });
    createdProgrammeIds.push(programme.id);

    await expect(
      db!.programme.create({
        data: {
          slug: "duplicate-slug-test",
          level: "MSC",
          title: "Second",
          summary: "s",
          body: "b",
          duration: "2 years",
          admissionRequirements: "r",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate ReviewAssignment and a second Review on the same assignment", async () => {
    const reviewer = await db!.user.create({
      data: { email: "reviewer-constraint-test@example.com", name: "Reviewer" },
    });
    createdUserIds.push(reviewer.id);

    const manuscript = await db!.manuscript.create({
      data: { title: "Test manuscript", abstract: "abstract", keywords: [] },
    });
    createdManuscriptIds.push(manuscript.id);

    const round = await db!.manuscriptRound.create({
      data: { manuscriptId: manuscript.id, number: 1, submittedAt: new Date() },
    });

    const assignment = await db!.reviewAssignment.create({
      data: {
        manuscriptId: manuscript.id,
        roundId: round.id,
        reviewerId: reviewer.id,
      },
    });

    await expect(
      db!.reviewAssignment.create({
        data: {
          manuscriptId: manuscript.id,
          roundId: round.id,
          reviewerId: reviewer.id,
        },
      }),
    ).rejects.toThrow();

    await db!.review.create({
      data: { assignmentId: assignment.id, recommendation: "ACCEPT" },
    });

    await expect(
      db!.review.create({
        data: { assignmentId: assignment.id, recommendation: "REJECT" },
      }),
    ).rejects.toThrow();
  });

  it("cascades User deletion to UserRole and UserToken", async () => {
    const user = await db!.user.create({
      data: { email: "cascade-user@example.com", name: "Cascade User" },
    });

    await db!.userRole.create({ data: { userId: user.id, role: "LECTURER" } });
    await db!.userToken.create({
      data: {
        userId: user.id,
        type: "INVITE",
        tokenHash: "hash-cascade-test",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await db!.user.delete({ where: { id: user.id } });
    // Deleted (not tracked for afterEach cleanup); assert the cascade worked.

    const roles = await db!.userRole.findMany({ where: { userId: user.id } });
    const tokens = await db!.userToken.findMany({ where: { userId: user.id } });
    expect(roles).toHaveLength(0);
    expect(tokens).toHaveLength(0);
  });

  it("restricts deleting a User who still holds a ReviewAssignment or EditorialDecision", async () => {
    const reviewer = await db!.user.create({
      data: { email: "restrict-reviewer@example.com", name: "Restricted Reviewer" },
    });
    const editor = await db!.user.create({
      data: { email: "restrict-editor@example.com", name: "Restricted Editor" },
    });
    createdUserIds.push(reviewer.id, editor.id);

    const manuscript = await db!.manuscript.create({
      data: { title: "Restrict test", abstract: "abstract", keywords: [] },
    });
    createdManuscriptIds.push(manuscript.id);

    const round = await db!.manuscriptRound.create({
      data: { manuscriptId: manuscript.id, number: 1, submittedAt: new Date() },
    });

    await db!.reviewAssignment.create({
      data: { manuscriptId: manuscript.id, roundId: round.id, reviewerId: reviewer.id },
    });
    await db!.editorialDecision.create({
      data: {
        manuscriptId: manuscript.id,
        roundId: round.id,
        editorId: editor.id,
        decision: "ACCEPT",
      },
    });

    await expect(db!.user.delete({ where: { id: reviewer.id } })).rejects.toThrow();
    await expect(db!.user.delete({ where: { id: editor.id } })).rejects.toThrow();
  });
});
