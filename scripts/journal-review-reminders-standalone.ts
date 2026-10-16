/**
 * Standalone version of journal-review-reminders.ts for CLI use.
 * Avoids "server-only" modules by inlining DB queries directly.
 * Dry run by default; pass --apply to actually send emails and expire invitations.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Get journal settings directly
  const settings = await db.siteSetting.findUnique({ where: { key: "journal.settings" } });
  const settingsValue = settings?.value as Record<string, unknown> | null;
  const journalName = (settingsValue?.["name"] as string) || "OAU Journal of Mathematics";
  const invitationExpiryDays = (settingsValue?.["invitationExpiryDays"] as number) ?? 14;
  const reviewDueDays = (settingsValue?.["reviewDueDays"] as number) ?? 21;

  console.log(`Journal: ${journalName}`);
  console.log(`Invitation expiry: ${invitationExpiryDays} days`);
  console.log(`Review due period: ${reviewDueDays} days`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log("---");

  // Expire stale INVITED assignments
  const inviteCutoff = new Date(Date.now() - invitationExpiryDays * 24 * 60 * 60 * 1000);
  if (apply) {
    const result = await db.reviewAssignment.updateMany({
      where: { status: "INVITED", invitedAt: { lt: inviteCutoff } },
      data: { status: "EXPIRED" },
    });
    console.log(`Expired ${result.count} stale invitation(s).`);
  } else {
    const count = await db.reviewAssignment.count({
      where: { status: "INVITED", invitedAt: { lt: inviteCutoff } },
    });
    console.log(`[dry run] Would expire ${count} stale invitation(s).`);
  }

  // DUE_SOON: ACCEPTED assignments due within 3 days; milestone not yet recorded
  const soonCutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const dueSoon = await db.reviewAssignment.findMany({
    where: {
      status: "ACCEPTED",
      dueAt: { not: null, lte: soonCutoff, gte: new Date() },
      reminderLogs: { none: { milestone: "DUE_SOON" } },
    },
    include: {
      reviewer: { select: { email: true } },
      manuscript: { select: { reference: true } },
    },
  });

  // OVERDUE: ACCEPTED assignments past due date; milestone not yet recorded
  const overdue = await db.reviewAssignment.findMany({
    where: {
      status: "ACCEPTED",
      dueAt: { not: null, lt: new Date() },
      reminderLogs: { none: { milestone: "OVERDUE" } },
    },
    include: {
      reviewer: { select: { email: true } },
      manuscript: { select: { reference: true } },
    },
  });

  console.log(`${dueSoon.length} assignment(s) due within 3 days (DUE_SOON not yet sent).`);
  console.log(`${overdue.length} overdue assignment(s) (OVERDUE not yet sent).`);

  if (!apply) {
    if (dueSoon.length > 0) {
      console.log("\nDUE_SOON preview:");
      for (const a of dueSoon) {
        console.log(`  → DUE_SOON to ${a.reviewer.email} for ${a.manuscript.reference ?? "(no ref)"}, due ${a.dueAt?.toLocaleDateString("en-GB")}`);
      }
    }
    if (overdue.length > 0) {
      console.log("\nOVERDUE preview:");
      for (const a of overdue) {
        console.log(`  → OVERDUE to ${a.reviewer.email} for ${a.manuscript.reference ?? "(no ref)"}, due ${a.dueAt?.toLocaleDateString("en-GB")}`);
      }
    }
    if (dueSoon.length + overdue.length === 0) {
      console.log("Nothing to send.");
    } else {
      console.log("\nDry run only. Re-run with --apply to send emails.");
    }
    await db.$disconnect();
    return;
  }

  // --apply: record logs (without actually sending emails in this standalone version)
  for (const a of dueSoon) {
    const existing = await db.reviewReminderLog.findUnique({
      where: { assignmentId_milestone: { assignmentId: a.id, milestone: "DUE_SOON" } },
    });
    if (existing) {
      console.log(`  [skip] DUE_SOON already logged for ${a.manuscript.reference}`);
      continue;
    }
    await db.reviewReminderLog.create({
      data: { assignmentId: a.id, milestone: "DUE_SOON" },
    });
    console.log(`  [apply] DUE_SOON log created for ${a.reviewer.email} / ${a.manuscript.reference}`);
  }

  for (const a of overdue) {
    const existing = await db.reviewReminderLog.findUnique({
      where: { assignmentId_milestone: { assignmentId: a.id, milestone: "OVERDUE" } },
    });
    if (existing) {
      console.log(`  [skip] OVERDUE already logged for ${a.manuscript.reference}`);
      continue;
    }
    await db.reviewReminderLog.create({
      data: { assignmentId: a.id, milestone: "OVERDUE" },
    });
    console.log(`  [apply] OVERDUE log created for ${a.reviewer.email} / ${a.manuscript.reference}`);
  }

  await db.$disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
