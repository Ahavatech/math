import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Readable } from "node:stream";
import { rmdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createLocalPrivateStorage } from "../src/lib/private-storage";
import { env } from "../src/lib/env";

const FIXTURE_TAG = "[DEV FIXTURE]";
const FIXTURE_EMAILS = {
  author: "dev-fixture-author@example.test",
  reviewer: "dev-fixture-reviewer@example.test",
  editor: "dev-fixture-editor@example.test",
  unassignedReviewer: "dev-fixture-unassigned-reviewer@example.test",
};

/**
 * Creates one clearly marked fixture manuscript (with a file, an
 * author, an accepted reviewer assignment, an unassigned reviewer, and
 * an editor) so the manuscript-access policy and /api/journal/files
 * route can be checked by hand. Refuses to run in production.
 * `--remove` deletes everything it created, including the file on disk.
 */
async function main() {
  if (env.NODE_ENV === "production") {
    console.error("journal:dev-fixture refuses to run with NODE_ENV=production.");
    process.exit(1);
  }

  const remove = process.argv.includes("--remove");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const storageRoot = env.PRIVATE_STORAGE_DIR ?? path.join(process.cwd(), ".private-storage");
  const storage = createLocalPrivateStorage(storageRoot);

  if (remove) {
    const manuscripts = await db.manuscript.findMany({ where: { title: { startsWith: FIXTURE_TAG } } });
    for (const manuscript of manuscripts) {
      const files = await db.manuscriptFile.findMany({ where: { manuscriptId: manuscript.id } });
      for (const file of files) {
        await storage.remove(file.storageKey);
        // Best-effort: also drop the now-empty two-level shard directories.
        const parts = file.storageKey.split("/");
        const level2 = path.join(storageRoot, parts[0], parts[1]);
        const level1 = path.join(storageRoot, parts[0]);
        await rmdir(level2).catch(() => {});
        await rmdir(level1).catch(() => {});
      }
      await db.manuscript.delete({ where: { id: manuscript.id } });
    }
    const users = await db.user.findMany({ where: { email: { in: Object.values(FIXTURE_EMAILS) } } });
    for (const user of users) {
      await db.auditLog.deleteMany({ where: { actorId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
    console.log(`Removed ${manuscripts.length} fixture manuscript(s) and ${users.length} fixture user(s).`);
    await db.$disconnect();
    return;
  }

  async function upsertUser(email: string, name: string, role: "AUTHOR" | "REVIEWER" | "JOURNAL_EDITOR") {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return existing;
    const user = await db.user.create({ data: { email, name, isActive: true } });
    await db.userRole.create({ data: { userId: user.id, role } });
    return user;
  }

  const author = await upsertUser(FIXTURE_EMAILS.author, `${FIXTURE_TAG} Author`, "AUTHOR");
  const reviewer = await upsertUser(FIXTURE_EMAILS.reviewer, `${FIXTURE_TAG} Accepted Reviewer`, "REVIEWER");
  const unassignedReviewer = await upsertUser(FIXTURE_EMAILS.unassignedReviewer, `${FIXTURE_TAG} Unassigned Reviewer`, "REVIEWER");
  const editor = await upsertUser(FIXTURE_EMAILS.editor, `${FIXTURE_TAG} Editor`, "JOURNAL_EDITOR");

  const manuscript = await db.manuscript.create({
    data: {
      title: `${FIXTURE_TAG} A manuscript for checking file access by hand`,
      abstract: "This manuscript exists only to verify the manuscript file access policy. Safe to remove.",
      keywords: ["fixture"],
      submittedById: author.id,
      status: "UNDER_REVIEW",
    },
  });

  const round = await db.manuscriptRound.create({
    data: { manuscriptId: manuscript.id, number: 1, submittedAt: new Date() },
  });

  const fakePdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("fixture manuscript body")]);
  const put = await storage.put(Readable.from([fakePdf]), { kind: "pdf", originalName: "fixture-manuscript.pdf" });

  const file = await db.manuscriptFile.create({
    data: {
      manuscriptId: manuscript.id,
      roundId: round.id,
      kind: "MANUSCRIPT",
      originalName: "fixture-manuscript.pdf",
      storageKey: put.key,
      mimeType: "application/pdf",
      size: put.size,
      sha256: put.sha256,
      uploadedById: author.id,
    },
  });

  const assignment = await db.reviewAssignment.create({
    data: {
      manuscriptId: manuscript.id,
      roundId: round.id,
      reviewerId: reviewer.id,
      status: "SUBMITTED",
      // Invitation token hash (32 random bytes, sha256 hashed -- single-use)
      tokenHash: crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex"),
      invitedById: editor.id,
      dueAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    },
  });

  // A submitted review with recommendation and comments
  await db.review.create({
    data: {
      assignmentId: assignment.id,
      recommendation: "MINOR_REVISION",
      commentsToAuthor: "Please revise section 2.",
      commentsToAuthorHtml: "<p>Please revise section 2.</p>",
      commentsToEditor: "Solid work, minor revision needed.",
      commentsToEditorHtml: "<p>Solid work, minor revision needed.</p>",
      isDraft: false,
      submittedAt: new Date(),
    },
  });

  // An unassigned reviewer assignment for access control testing
  await db.reviewAssignment.create({
    data: { manuscriptId: manuscript.id, roundId: round.id, reviewerId: unassignedReviewer.id, status: "INVITED", invitedById: editor.id },
  });

  // An editorial decision
  await db.editorialDecision.create({
    data: {
      manuscriptId: manuscript.id,
      roundId: round.id,
      decision: "MINOR_REVISION",
      letter: "Thank you for your submission. Please address the reviewers' comments.",
      letterHtml: "<p>Thank you for your submission. Please address the reviewers' comments.</p>",
      editorId: editor.id,
    },
  });

  console.log("Created fixture manuscript. Check access with:");
  console.log(`  GET /api/journal/files/${file.id}`);
  console.log(`  author (${author.email})              -> allowed`);
  console.log(`  accepted reviewer (${reviewer.email}) -> allowed, generic filename`);
  console.log(`  unassigned reviewer (${unassignedReviewer.email}) -> 404`);
  console.log(`  editor (${editor.email})               -> allowed`);
  console.log(`  HOD without a journal role             -> 404`);
  console.log(`  ReviewAssignment (SUBMITTED): ${assignment.id}`);
  console.log("Run with --remove to delete everything this script created.");

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
