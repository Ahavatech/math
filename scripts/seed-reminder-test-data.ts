/**
 * Seed reminder test data: one DUE_SOON, one OVERDUE assignment.
 * Run against the dev database only (not _test).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const RUN = randomUUID().slice(0, 8);

  // Create minimal users
  const author = await db.user.create({
    data: {
      id: `rmt-author-${RUN}`,
      email: `rmt-author-${RUN}@oau-test.invalid`,
      name: "Test Author",
      passwordHash: "x",
    } as Parameters<typeof db.user.create>[0]["data"],
  });

  const rv1 = await db.user.create({
    data: {
      id: `rmt-rv1-${RUN}`,
      email: `rmt-rv1-${RUN}@oau-test.invalid`,
      name: "Due Soon Reviewer",
      passwordHash: "x",
    },
  });

  const rv2 = await db.user.create({
    data: {
      id: `rmt-rv2-${RUN}`,
      email: `rmt-rv2-${RUN}@oau-test.invalid`,
      name: "Overdue Reviewer",
      passwordHash: "x",
    },
  });

  // Create manuscript
  const ms = await db.manuscript.create({
    data: {
      id: `rmt-ms-${RUN}`,
      submittedBy: { connect: { id: author.id } },
      reference: `OAU-RMT-${RUN}`,
      status: "UNDER_REVIEW",
      title: "Test Paper for Reminder Script",
      abstract: "A test abstract.",
    },
  });

  // Create a review round
  const round = await db.manuscriptRound.create({
    data: {
      manuscriptId: ms.id,
      number: 1,
      submittedAt: new Date(),
    },
  });

  // DUE_SOON: due in 2 days
  const dueSoonDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  await db.reviewAssignment.create({
    data: {
      id: `rmt-a1-${RUN}`,
      manuscriptId: ms.id,
      roundId: round.id,
      reviewerId: rv1.id,
      status: "ACCEPTED",
      invitedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      dueAt: dueSoonDate,
    },
  });

  // OVERDUE: due 5 days ago
  const overdueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  await db.reviewAssignment.create({
    data: {
      id: `rmt-a2-${RUN}`,
      manuscriptId: ms.id,
      roundId: round.id,
      reviewerId: rv2.id,
      status: "ACCEPTED",
      invitedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      respondedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
      dueAt: overdueDate,
    },
  });

  console.log(`Seeded test data with RUN=${RUN}`);
  console.log(`  DUE_SOON reviewer: ${rv1.email}, due ${dueSoonDate.toLocaleDateString("en-GB")}`);
  console.log(`  OVERDUE reviewer: ${rv2.email}, due ${overdueDate.toLocaleDateString("en-GB")}`);
  console.log(`  Manuscript: ${ms.reference}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
