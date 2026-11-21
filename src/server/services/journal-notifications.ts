import "server-only";
import type { PrismaClient } from "@prisma/client";
import {
  sendDecisionAvailableEmail,
  sendMovedToReviewEmail,
  sendNewSubmissionToEditorsEmail,
  sendRevisionReceivedEmail,
  sendReturnedToAuthorEmail,
  sendReviewSubmittedEmail,
  sendReviewerAcceptedEmail,
  sendReviewerDeclinedEmail,
  sendReviewerInvitationEmail,
  sendReviewerThankYouEmail,
  sendSubmissionReceivedEmail,
} from "@/lib/email";
import { env } from "@/lib/env";
import { getSetting } from "@/server/services/site-settings";

/**
 * The emails that move the journal along: a submission is received, editors are
 * told, the author hears about screening and the decision, the reviewer is
 * invited and thanked, and the editors hear when a reviewer answers or a review
 * arrives.
 *
 * Email is a courtesy on top of the workflow, never part of it. Every function
 * here catches its own failure and logs it, so a mail outage can never stop a
 * submission, a decision or an invitation from being recorded.
 */

type Db = PrismaClient;

async function safely(what: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(`Journal email not sent (${what}):`, error);
  }
}

async function journalName(db: Db): Promise<string> {
  try {
    const settings = await getSetting(db, "journal.settings");
    return settings.name || "the Journal";
  } catch {
    return "the Journal";
  }
}

/** Everyone who works as an editor (in chief or editor) and can still sign in. */
async function allEditorEmails(db: Db): Promise<string[]> {
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { in: ["JOURNAL_EDITOR_IN_CHIEF", "JOURNAL_EDITOR"] } } },
    },
    select: { email: true },
  });
  return rows.map((r) => r.email);
}

async function manuscriptBasics(db: Db, manuscriptId: string) {
  return db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      reference: true,
      submittedBy: { select: { email: true, isActive: true } },
      handlingEditor: { select: { email: true, isActive: true } },
    },
  });
}

/** The editor looking after this manuscript, or every editor if none has been assigned yet. */
async function editorEmailsFor(db: Db, ms: { handlingEditor: { email: string; isActive: boolean } | null }) {
  if (ms.handlingEditor?.isActive) return [ms.handlingEditor.email];
  return allEditorEmails(db);
}

/** An author has finished a submission: confirm to the author and alert the editors. */
export async function notifySubmitted(db: Db, manuscriptId: string): Promise<void> {
  await safely("submission received", async () => {
    const ms = await manuscriptBasics(db, manuscriptId);
    if (!ms?.reference) return;
    if (ms.submittedBy?.isActive) {
      await sendSubmissionReceivedEmail({ to: ms.submittedBy.email, reference: ms.reference });
    }
    const editors = await allEditorEmails(db);
    if (editors.length > 0) {
      const manuscriptUrl = new URL(`/admin/journal/manuscripts/${ms.id}`, env.AUTH_URL).toString();
      await sendNewSubmissionToEditorsEmail({ emails: editors, reference: ms.reference, manuscriptUrl });
    }
  });
}

/** Screening sent the manuscript back to its author for changes. */
export async function notifyReturnedToAuthor(db: Db, manuscriptId: string): Promise<void> {
  await safely("returned to author", async () => {
    const ms = await manuscriptBasics(db, manuscriptId);
    if (!ms?.reference || !ms.submittedBy?.isActive) return;
    await sendReturnedToAuthorEmail({ to: ms.submittedBy.email, reference: ms.reference });
  });
}

/** Screening passed: the manuscript is now in peer review. */
export async function notifyMovedToReview(db: Db, manuscriptId: string): Promise<void> {
  await safely("moved to review", async () => {
    const ms = await manuscriptBasics(db, manuscriptId);
    if (!ms?.reference || !ms.submittedBy?.isActive) return;
    await sendMovedToReviewEmail({ to: ms.submittedBy.email, reference: ms.reference });
  });
}

/** A reviewer has been invited: send them the accept and decline links. */
export async function notifyReviewerInvited(
  db: Db,
  input: { manuscriptId: string; reviewerUserId: string; rawToken: string },
): Promise<void> {
  await safely("reviewer invitation", async () => {
    const [ms, reviewer, name, settings] = await Promise.all([
      manuscriptBasics(db, input.manuscriptId),
      db.user.findUnique({ where: { id: input.reviewerUserId }, select: { email: true, isActive: true } }),
      journalName(db),
      getSetting(db, "journal.settings").catch(() => null),
    ]);
    if (!ms?.reference || !reviewer?.isActive) return;
    await sendReviewerInvitationEmail({
      to: reviewer.email,
      reference: ms.reference,
      rawToken: input.rawToken,
      dueDays: settings?.reviewDueDays ?? 21,
      journalName: name,
    });
  });
}

/** A reviewer accepted or declined: tell the editor in charge. */
export async function notifyReviewerResponded(
  db: Db,
  input: { manuscriptId: string; accepted: boolean },
): Promise<void> {
  await safely(input.accepted ? "reviewer accepted" : "reviewer declined", async () => {
    const ms = await manuscriptBasics(db, input.manuscriptId);
    if (!ms?.reference) return;
    const emails = await editorEmailsFor(db, ms);
    if (emails.length === 0) return;
    const send = input.accepted ? sendReviewerAcceptedEmail : sendReviewerDeclinedEmail;
    await send({ emails, reference: ms.reference, journalName: await journalName(db) });
  });
}

/** A review has come in: tell the editor in charge and thank the reviewer. */
export async function notifyReviewSubmitted(db: Db, assignmentId: string): Promise<void> {
  await safely("review submitted", async () => {
    const assignment = await db.reviewAssignment.findUnique({
      where: { id: assignmentId },
      select: { manuscriptId: true, reviewer: { select: { email: true, isActive: true } } },
    });
    if (!assignment) return;
    const ms = await manuscriptBasics(db, assignment.manuscriptId);
    if (!ms?.reference) return;
    const name = await journalName(db);
    const editors = await editorEmailsFor(db, ms);
    if (editors.length > 0) {
      await sendReviewSubmittedEmail({ emails: editors, reference: ms.reference, manuscriptId: ms.id, journalName: name });
    }
    if (assignment.reviewer?.isActive) {
      await sendReviewerThankYouEmail({ to: assignment.reviewer.email, reference: ms.reference, journalName: name });
    }
  });
}

/** The editor has recorded a decision: the author can now read it. */
export async function notifyDecision(db: Db, manuscriptId: string): Promise<void> {
  await safely("decision available", async () => {
    const ms = await manuscriptBasics(db, manuscriptId);
    if (!ms?.reference || !ms.submittedBy?.isActive) return;
    await sendDecisionAvailableEmail({ to: ms.submittedBy.email, reference: ms.reference });
  });
}

/** The author sent a revised manuscript: tell the editor in charge. */
export async function notifyRevisionReceived(db: Db, manuscriptId: string): Promise<void> {
  await safely("revision received", async () => {
    const ms = await manuscriptBasics(db, manuscriptId);
    if (!ms?.reference) return;
    const round = await db.manuscript.findUnique({ where: { id: manuscriptId }, select: { currentRound: true } });
    const emails = await editorEmailsFor(db, ms);
    if (emails.length === 0) return;
    await sendRevisionReceivedEmail({
      emails,
      reference: ms.reference,
      round: round?.currentRound ?? 2,
      manuscriptId: ms.id,
      journalName: await journalName(db),
    });
  });
}
