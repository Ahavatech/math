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
 * Run daily via cron or manually.
 * Dry run by default; pass --apply to actually send emails and expire invitations.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const settings = await getJournalSettingsPublic();
  const journalName = settings.name || "OAU Journal of Mathematics";
  const reviewDueDays = settings.reviewDueDays ?? 21;

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

  // Find ACCEPTED assignments that are due soon (within 3 days) but not yet reminded
  const soonCutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const dueSoon = await db.reviewAssignment.findMany({
    where: {
      status: "ACCEPTED",
      dueAt: { not: null, lte: soonCutoff, gte: new Date() },
    },
    include: {
      reviewer: { select: { email: true } },
      manuscript: { select: { reference: true } },
    },
  });

  // Find ACCEPTED assignments that are overdue
  const overdue = await db.reviewAssignment.findMany({
    where: {
      status: "ACCEPTED",
      dueAt: { not: null, lt: new Date() },
    },
    include: {
      reviewer: { select: { email: true } },
      manuscript: { select: { reference: true } },
    },
  });

  console.log(`${dueSoon.length} assignment(s) due within 3 days.`);
  console.log(`${overdue.length} overdue assignment(s).`);

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
    console.log(`  Reminder sent to ${a.reviewer.email} for ${a.manuscript.reference}`);
  }

  for (const a of overdue) {
    await sendReviewerOverdueEmail({
      to: a.reviewer.email,
      reference: a.manuscript.reference ?? a.manuscriptId,
      assignmentId: a.id,
      journalName,
    });
    console.log(`  Overdue notice sent to ${a.reviewer.email} for ${a.manuscript.reference}`);
  }

  await db.$disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
