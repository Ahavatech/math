import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "./test-db";

const db = await getTestDb();

if (db === null) {
  console.warn(
    "[tests/unit/database/constraints.test.ts] skipped: no reachable TEST_DATABASE_URL",
  );
}

describe.skipIf(db === null)("relational constraints", () => {
  afterEach(async () => {
    // Clean up in dependency order (children before parents).
    await db!.userToken.deleteMany();
    await db!.userRole.deleteMany();
    await db!.reviewAssignment.deleteMany();
    await db!.review.deleteMany();
    await db!.manuscriptRound.deleteMany();
    await db!.manuscript.deleteMany();
    await db!.editorialDecision.deleteMany();
    await db!.lecturerProfile.deleteMany();
    await db!.user.deleteMany();
    await db!.programme.deleteMany();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("rejects a duplicate (userId, role) pair but allows a second distinct role", async () => {
    const user = await db!.user.create({
      data: { email: "constraints-role@example.com", name: "Test User" },
    });

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
    await db!.programme.create({
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
      data: { email: "reviewer@example.com", name: "Reviewer" },
    });
    const manuscript = await db!.manuscript.create({
      data: { title: "Test manuscript", abstract: "abstract", keywords: [] },
    });
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
    const manuscript = await db!.manuscript.create({
      data: { title: "Restrict test", abstract: "abstract", keywords: [] },
    });
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
