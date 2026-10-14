import "server-only";
import type { PrismaClient } from "@prisma/client";
import { hasPermission, hasRole, type SessionUser } from "@/lib/rbac";
import { logAction } from "@/server/services/audit";

function isConflicted(userEmail: string, userId: string, ms: { submittedById: string; authors: Array<{ email: string | null }> }): boolean {
  if (ms.submittedById === userId) return true;
  return ms.authors.some((a) => a.email && a.email.toLowerCase() === userEmail.toLowerCase());
}

async function getUserEmail(db: PrismaClient, userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? "";
}

export interface ManuscriptListRow {
  id: string;
  reference: string | null;
  title: string;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  handlingEditorId: string | null;
  hasActions: boolean;
}

export async function listManuscripts(
  db: PrismaClient,
  user: SessionUser,
  filters?: { status?: string; search?: string },
): Promise<ManuscriptListRow[]> {
  const canRead =
    hasPermission(user, "journal.editorial") || hasPermission(user, "journal.manuscripts.read");
  if (!canRead) throw new Error("Unauthorized");

  const userEmail = await getUserEmail(db, user.id);

  const rows = await db.manuscript.findMany({
    where: {
      status: filters?.status ? (filters.status as any) : { not: "INCOMPLETE" },
      ...(filters?.search
        ? { title: { contains: filters.search, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      submittedById: true,
      handlingEditorId: true,
      authors: { select: { email: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const isEditorial = hasPermission(user, "journal.editorial");

  return rows
    .filter((ms) => !isConflicted(userEmail, user.id, ms))
    .map((ms) => ({
      id: ms.id,
      reference: ms.reference,
      title: ms.title,
      status: ms.status,
      submittedAt: ms.submittedAt,
      createdAt: ms.createdAt,
      handlingEditorId: ms.handlingEditorId,
      hasActions: isEditorial,
    }));
}

export async function getManuscriptDetail(
  db: PrismaClient,
  user: SessionUser,
  manuscriptId: string,
) {
  const canRead =
    hasPermission(user, "journal.editorial") || hasPermission(user, "journal.manuscripts.read");
  if (!canRead) throw new Error("Unauthorized");

  const userEmail = await getUserEmail(db, user.id);

  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      reference: true,
      title: true,
      abstract: true,
      keywords: true,
      status: true,
      submittedById: true,
      submittedAt: true,
      createdAt: true,
      handlingEditorId: true,
      coverLetter: true,
      suggestedReviewers: true,
      excludedReviewers: true,
      agreementVersion: true,
      agreementAcceptedAt: true,
      authors: { select: { id: true, name: true, affiliation: true, email: true, isCorresponding: true, order: true }, orderBy: { order: "asc" } },
      files: { select: { id: true, kind: true, originalName: true, size: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      events: { select: { id: true, type: true, visibleToAuthor: true, note: true, actorId: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!ms) throw new Error("Manuscript not found");

  if (isConflicted(userEmail, user.id, ms)) {
    throw new Error("Manuscript not found (conflict of interest)");
  }

  // HOD reads are audit-logged (DECISIONS.md #60)
  if (hasRole(user, "HOD") && !hasPermission(user, "journal.editorial")) {
    await logAction(db, {
      actorId: user.id,
      action: "journal.manuscript.hod_read",
      entityType: "Manuscript",
      entityId: manuscriptId,
      summary: `HOD read manuscript detail (id: ${manuscriptId})`,
    });
  } else if (hasRole(user, "SUPER_ADMIN")) {
    await logAction(db, {
      actorId: user.id,
      action: "journal.manuscript.admin_read",
      entityType: "Manuscript",
      entityId: manuscriptId,
      summary: `Admin read manuscript detail (id: ${manuscriptId})`,
    });
  }

  // Filter TITLE_PAGE files for non-editorial HOD
  const isEditorial = hasPermission(user, "journal.editorial");
  const files = isEditorial
    ? ms.files
    : ms.files.filter((f) => f.kind !== "TITLE_PAGE");

  return { ...ms, files, hasActions: isEditorial };
}

export async function assignHandlingEditor(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
  editorId: string,
): Promise<void> {
  const isEiC = hasRole(actor, "JOURNAL_EDITOR_IN_CHIEF");
  const isSuperAdmin = hasRole(actor, "SUPER_ADMIN");
  if (!isEiC && !isSuperAdmin) throw new Error("Unauthorized: only EiC or SUPER_ADMIN can assign editors");

  // Check COI for the editor being assigned
  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { submittedById: true, authors: { select: { email: true } } },
  });
  if (!ms) throw new Error("Manuscript not found");

  const editorUser = await db.user.findUnique({ where: { id: editorId }, select: { email: true, emailVerifiedAt: true } });
  if (!editorUser) throw new Error("Editor not found");

  const editorEmail = editorUser.emailVerifiedAt ? editorUser.email : "";
  if (isConflicted(editorEmail, editorId, ms)) {
    throw new Error("Cannot assign: editor has a COI with this manuscript");
  }

  await db.$transaction(async (tx) => {
    await tx.manuscript.update({
      where: { id: manuscriptId },
      data: { handlingEditorId: editorId, status: "SCREENING" },
    });
    await tx.manuscriptEvent.create({
      data: { manuscriptId, type: "EDITOR_ASSIGNED", actorId: actor.id, visibleToAuthor: false },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.manuscript.assign_editor",
      entityType: "Manuscript", entityId: manuscriptId,
      summary: "Handling editor assigned",
    });
  });
}

export async function returnToAuthor(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
  message: string,
): Promise<void> {
  if (!message?.trim()) throw new Error("A message is required when returning to author");
  const isEiC = hasRole(actor, "JOURNAL_EDITOR_IN_CHIEF");
  const isSuperAdmin = hasRole(actor, "SUPER_ADMIN");
  const ms = await db.manuscript.findUnique({ where: { id: manuscriptId }, select: { handlingEditorId: true, status: true } });
  if (!ms) throw new Error("Manuscript not found");

  const isHandling = hasRole(actor, "JOURNAL_EDITOR") && ms.handlingEditorId === actor.id;
  if (!isEiC && !isSuperAdmin && !isHandling) throw new Error("Unauthorized: only EiC, SUPER_ADMIN, or handling editor");

  await db.$transaction(async (tx) => {
    await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "RETURNED_TO_AUTHOR" } });
    await tx.manuscriptEvent.create({
      data: { manuscriptId, type: "RETURNED_TO_AUTHOR", actorId: actor.id, visibleToAuthor: true, note: message },
    });
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.manuscript.return_to_author",
      entityType: "Manuscript", entityId: manuscriptId,
      summary: "Manuscript returned to author for revisions",
    });
  });
}

export async function deskReject(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
  letter: string,
): Promise<void> {
  if (!letter?.trim()) throw new Error("A decision letter is required for desk rejection");
  const isEiC = hasRole(actor, "JOURNAL_EDITOR_IN_CHIEF");
  const isSuperAdmin = hasRole(actor, "SUPER_ADMIN");
  const ms = await db.manuscript.findUnique({ where: { id: manuscriptId }, select: { handlingEditorId: true, status: true } });
  if (!ms) throw new Error("Manuscript not found");

  const isHandling = hasRole(actor, "JOURNAL_EDITOR") && ms.handlingEditorId === actor.id;
  if (!isEiC && !isSuperAdmin && !isHandling) {
    throw new Error("Unauthorized: only EiC, SUPER_ADMIN, or the assigned handling editor can desk-reject");
  }

  const round = await db.manuscriptRound.findFirst({
    where: { manuscriptId },
    orderBy: { number: "desc" },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    await tx.manuscript.update({ where: { id: manuscriptId }, data: { status: "REJECTED" } });
    await tx.manuscriptEvent.create({
      data: { manuscriptId, type: "DESK_REJECTED", actorId: actor.id, visibleToAuthor: true },
    });
    if (round) {
      await tx.editorialDecision.create({
        data: { manuscriptId, roundId: round.id, editorId: actor.id, decision: "REJECTED", letter },
      });
    }
    await logAction(tx as unknown as PrismaClient, {
      actorId: actor.id, action: "journal.manuscript.desk_reject",
      entityType: "Manuscript", entityId: manuscriptId,
      summary: "Manuscript desk-rejected",
    });
  });
}

export async function approveForReview(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
): Promise<void> {
  const isEiC = hasRole(actor, "JOURNAL_EDITOR_IN_CHIEF");
  const isSuperAdmin = hasRole(actor, "SUPER_ADMIN");
  const ms = await db.manuscript.findUnique({ where: { id: manuscriptId }, select: { handlingEditorId: true } });
  if (!ms) throw new Error("Manuscript not found");

  const isHandling = hasRole(actor, "JOURNAL_EDITOR") && ms.handlingEditorId === actor.id;
  if (!isEiC && !isSuperAdmin && !isHandling) throw new Error("Unauthorized");

  await db.$transaction(async (tx) => {
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
}

export async function addInternalNote(
  db: PrismaClient,
  actor: SessionUser,
  manuscriptId: string,
  note: string,
): Promise<void> {
  if (!hasPermission(actor, "journal.editorial")) throw new Error("Unauthorized");
  if (!note?.trim()) throw new Error("Note text is required");

  await db.manuscriptEvent.create({
    data: { manuscriptId, type: "INTERNAL_NOTE", actorId: actor.id, visibleToAuthor: false, note },
  });
}
