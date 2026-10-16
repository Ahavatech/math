import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { expireInvitations } from "../src/server/services/reviewer-invitation";
import {
  sendReviewerReminderEmail,
  sendReviewerOverdueEmail,
} from "../src/lib/email";
import { getJournalSettingsPublic } from "../src/server/services/journal-settings";

/**
 * Sends review reminders and overdue notices. Also expires stale invitations.
 * Idempotent: each milestone ("DUE_SOON", "OVERDUE") is recorded in ReviewReminderLog;
 * re-running never sends the same milestone twice to the same assignment.
 * Dry run by default; pass --apply to actually send emails and expire invitations.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const settings = await getJournalSettingsPublic();
  const journalName = settings.name || "OAU Journal of Mathematics";

  // Expire stale INVITED assignments
  if (apply) {
    const expired = await expireInvitations(db, settings.invitationExpiryDays ?? 14);
    console.log(`Expired ${expired} stale invitation(s).`);
  } else {
    const cutoff = new Date(Date.now() - (settings.invitationExpiryDays ?? 14) * 24 * 60 * 60 * 1000);
    const count = await db.reviewAssignment.count({
      where: { status: "INVITED", invitedAt: { lt: cutoff } },
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
    if (dueSoon.length + overdue.length > 0) {
      console.log("Dry run only. Re-run with --apply to send emails.");
    }
    await db.$disconnect();
    return;
  }

  for (const a of dueSoon) {
    const dueDate = a.dueAt!.toLocaleDateString("en-GB");
    await sendReviewerReminderEmail({
      to: a.reviewer.email,
      reference: a.manuscript.reference ?? a.manuscriptId,
      assignmentId: a.id,
      dueDate,
      journalName,
    });
    await db.reviewReminderLog.create({
      data: { assignmentId: a.id, milestone: "DUE_SOON" },
    });
    console.log(`  DUE_SOON reminder sent to ${a.reviewer.email} for ${a.manuscript.reference}`);
  }

  for (const a of overdue) {
    await sendReviewerOverdueEmail({
      to: a.reviewer.email,
      reference: a.manuscript.reference ?? a.manuscriptId,
      assignmentId: a.id,
      journalName,
    });
    await db.reviewReminderLog.create({
      data: { assignmentId: a.id, milestone: "OVERDUE" },
    });
    console.log(`  OVERDUE notice sent to ${a.reviewer.email} for ${a.manuscript.reference}`);
  }

  await db.$disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
