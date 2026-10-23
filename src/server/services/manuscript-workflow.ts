import "server-only";
import type { ManuscriptStatus, Prisma, PrismaClient } from "@prisma/client";
import { hasRole, type SessionUser } from "@/lib/rbac";
import { logAction } from "@/server/services/audit";

type Db = PrismaClient | Prisma.TransactionClient;

export type WorkflowAction =
  | "SUBMIT"
  | "ASSIGN_EDITOR"
  | "RETURN_TO_AUTHOR"
  | "RESUBMIT"
  | "DESK_REJECT"
  | "APPROVE_FOR_REVIEW"
  | "WITHDRAW"
  | "PUBLISH";

export type TransitionResult =
  | { ok: true; newStatus: ManuscriptStatus }
  | { ok: false; reason: string };

function deny(reason: string): TransitionResult {
  return { ok: false, reason };
}

export async function transition(
  db: Db,
  actor: SessionUser,
  manuscriptId: string,
  action: WorkflowAction,
  opts?: { handlingEditorId?: string; note?: string; letter?: string },
): Promise<TransitionResult> {
  const ms = await (db as PrismaClient).manuscript.findUnique({
    where: { id: manuscriptId },
    select: { status: true, submittedById: true, handlingEditorId: true },
  });
  if (!ms) return deny("Manuscript not found");

  const isOwner = ms.submittedById === actor.id;
  const isEiC = hasRole(actor, "JOURNAL_EDITOR_IN_CHIEF");
  const isSuperAdmin = hasRole(actor, "SUPER_ADMIN");
  const isHandlingEditor = hasRole(actor, "JOURNAL_EDITOR") && ms.handlingEditorId === actor.id;
  const isEditorialAuthority = isEiC || isSuperAdmin;

  switch (action) {
    case "SUBMIT": {
      if (ms.status !== "INCOMPLETE") return deny("Only INCOMPLETE manuscripts can be submitted");
      if (!isOwner) return deny("Only the submitting author can submit");
      // Actual submission logic lives in manuscript-submission.ts; this
      // transition entry is only here so the state machine covers it.
      return { ok: true, newStatus: "SUBMITTED" };
    }

    case "ASSIGN_EDITOR": {
      if (ms.status !== "SUBMITTED" && ms.status !== "SCREENING") {
        return deny("Can only assign editor to SUBMITTED or SCREENING manuscripts");
      }
      if (!isEditorialAuthority) return deny("Only EiC or SUPER_ADMIN can assign an editor");

      const handlingEditorId = opts?.handlingEditorId ?? ms.handlingEditorId;
      await (db as PrismaClient).$transaction(async (tx) => {
        await tx.manuscript.update({
          where: { id: manuscriptId },
          data: { status: "SCREENING", handlingEditorId },
        });
        await tx.manuscriptEvent.create({
          data: { manuscriptId, type: "EDITOR_ASSIGNED", actorId: actor.id, visibleToAuthor: false, note: opts?.note ?? null },
        });
        await logAction(tx as unknown as PrismaClient, {
          actorId: actor.id, action: "journal.manuscript.assign_editor",
          entityType: "Manuscript", entityId: manuscriptId,
          summary: "Handling editor assigned",
        });
      });
      return { ok: true, newStatus: "SCREENING" };
    }

    case "RETURN_TO_AUTHOR": {
      if (ms.status !== "SUBMITTED" && ms.status !== "SCREENING") {
        return deny("Can only return a SUBMITTED or SCREENING manuscript");
      }
      if (!isEditorialAuthority && !isHandlingEditor) {
        return deny("Only EiC, SUPER_ADMIN, or the handling editor can return the manuscript");
      }

      await (db as PrismaClient).$transaction(async (tx) => {
        await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "RETURNED_TO_AUTHOR" } });
        await tx.manuscriptEvent.create({
          data: { manuscriptId, type: "RETURNED_TO_AUTHOR", actorId: actor.id, visibleToAuthor: true, note: opts?.note ?? null },
        });
        await logAction(tx as unknown as PrismaClient, {
          actorId: actor.id, action: "journal.manuscript.return_to_author",
          entityType: "Manuscript", entityId: manuscriptId,
          summary: "Manuscript returned to author for revisions",
        });
      });
      return { ok: true, newStatus: "RETURNED_TO_AUTHOR" };
    }

    case "RESUBMIT": {
      if (ms.status !== "RETURNED_TO_AUTHOR") return deny("Only RETURNED_TO_AUTHOR manuscripts can be resubmitted");
      if (!isOwner) return deny("Only the submitting author can resubmit");

      await (db as PrismaClient).$transaction(async (tx) => {
        await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "SCREENING" } });
        await tx.manuscriptEvent.create({
          data: { manuscriptId, type: "RESUBMITTED", actorId: actor.id, visibleToAuthor: true },
        });
        await logAction(tx as unknown as PrismaClient, {
          actorId: actor.id, action: "journal.manuscript.resubmit",
          entityType: "Manuscript", entityId: manuscriptId,
          summary: "Manuscript resubmitted",
        });
      });
      return { ok: true, newStatus: "SCREENING" };
    }

    case "DESK_REJECT": {
      if (ms.status !== "SUBMITTED" && ms.status !== "SCREENING") {
        return deny("Can only desk-reject SUBMITTED or SCREENING manuscripts");
      }
      // Only EiC/SUPER_ADMIN or the handling editor for this manuscript
      if (!isEditorialAuthority && !isHandlingEditor) {
        return deny("Only EiC, SUPER_ADMIN, or the assigned handling editor can desk-reject");
      }

      // Need the current round for the EditorialDecision
      const round = await (db as PrismaClient).manuscriptRound.findFirst({
        where: { manuscriptId },
        orderBy: { number: "desc" },
        select: { id: true },
      });

      await (db as PrismaClient).$transaction(async (tx) => {
        await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "REJECTED" } });
        await tx.manuscriptEvent.create({
          data: { manuscriptId, type: "DESK_REJECTED", actorId: actor.id, visibleToAuthor: true, note: null },
        });
        // Create editorial decision if we have a round (no letter body in AuditLog)
        if (round) {
          await tx.editorialDecision.create({
            data: {
              manuscriptId,
              roundId: round.id,
              editorId: actor.id,
              decision: "REJECT",
              letter: opts?.letter ?? null,
            },
          });
        }
        await logAction(tx as unknown as PrismaClient, {
          actorId: actor.id, action: "journal.manuscript.desk_reject",
          entityType: "Manuscript", entityId: manuscriptId,
          summary: "Manuscript desk-rejected",
        });
      });
      return { ok: true, newStatus: "REJECTED" };
    }

    case "APPROVE_FOR_REVIEW": {
      if (ms.status !== "SUBMITTED" && ms.status !== "SCREENING") {
        return deny("Can only approve SUBMITTED or SCREENING manuscripts");
      }
      if (!isEditorialAuthority && !isHandlingEditor) {
        return deny("Only EiC, SUPER_ADMIN, or the handling editor can approve for review");
      }

      await (db as PrismaClient).$transaction(async (tx) => {
        await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "UNDER_REVIEW" } });
        await tx.manuscriptEvent.create({
          data: { manuscriptId, type: "APPROVED_FOR_REVIEW", actorId: actor.id, visibleToAuthor: true },
        });
        await logAction(tx as unknown as PrismaClient, {
          actorId: actor.id, action: "journal.manuscript.approve_for_review",
          entityType: "Manuscript", entityId: manuscriptId,
          summary: "Manuscript approved for peer review",
        });
      });
      return { ok: true, newStatus: "UNDER_REVIEW" };
    }

    case "PUBLISH": {
      if (ms.status !== "ACCEPTED") return deny("Only ACCEPTED manuscripts can be published");
      // COI check: editor cannot publish their own submission
      if (ms.submittedById === actor.id) return deny("Conflict of interest: editor cannot publish their own submission");
      // Only EiC or SUPER_ADMIN may publish; JOURNAL_EDITOR and HOD/ADMIN cannot
      if (!isEiC && !isSuperAdmin) return deny("Only EiC or SUPER_ADMIN can publish a manuscript");

      await (db as PrismaClient).$transaction(async (tx) => {
        await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "PUBLISHED" } });
        await tx.manuscriptEvent.create({
          data: { manuscriptId, type: "PUBLISHED", actorId: actor.id, visibleToAuthor: true, note: opts?.note ?? null },
        });
        await logAction(tx as unknown as PrismaClient, {
          actorId: actor.id, action: "journal.manuscript.publish",
          entityType: "Manuscript", entityId: manuscriptId,
          summary: "Manuscript published as journal article",
        });
      });
      return { ok: true, newStatus: "PUBLISHED" };
    }

    case "WITHDRAW": {
      const withdrawableFromDraft: ManuscriptStatus[] = ["INCOMPLETE"];
      const withdrawableFromSubmitted: ManuscriptStatus[] = ["SUBMITTED", "SCREENING", "RETURNED_TO_AUTHOR"];

      if (!isOwner) return deny("Only the submitting author can withdraw");

      if (withdrawableFromDraft.includes(ms.status)) {
        // Delete the draft entirely (files are cleaned up by cascade)
        await (db as PrismaClient).manuscript.delete({ where: { id: manuscriptId } });
        return { ok: true, newStatus: "WITHDRAWN" as ManuscriptStatus };
      }

      if (withdrawableFromSubmitted.includes(ms.status)) {
        await (db as PrismaClient).$transaction(async (tx) => {
          await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "WITHDRAWN" } });
          await tx.manuscriptEvent.create({
            data: { manuscriptId, type: "WITHDRAWN", actorId: actor.id, visibleToAuthor: true },
          });
          await logAction(tx as unknown as PrismaClient, {
            actorId: actor.id, action: "journal.manuscript.withdraw",
            entityType: "Manuscript", entityId: manuscriptId,
            summary: "Manuscript withdrawn by author",
          });
        });
        return { ok: true, newStatus: "WITHDRAWN" };
      }

      return deny(`Cannot withdraw a manuscript with status ${ms.status}`);
    }

    default:
      return deny("Unknown action");
  }
}
