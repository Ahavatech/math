import "server-only";
import type { ManuscriptFileKind, ReviewAssignmentStatus } from "@prisma/client";
import { hasRole, type SessionUser } from "@/lib/rbac";

export interface ManuscriptFileAccessInput {
  id: string;
  kind: ManuscriptFileKind;
  roundId: string | null;
  roundNumber: number | null;
  manuscriptId: string;
  manuscriptSubmittedById: string | null;
  originalName: string;
}

export interface ReviewerAssignmentInput {
  roundId: string;
  status: ReviewAssignmentStatus;
}

const REVIEWER_ALLOWED_KINDS: ManuscriptFileKind[] = [
  "MANUSCRIPT",
  "SUPPLEMENTARY",
  "REVISED",
  "RESPONSE_TO_REVIEWERS",
];
const REVIEWER_ALLOWED_STATUSES: ReviewAssignmentStatus[] = ["ACCEPTED", "SUBMITTED"];

/**
 * Editorial confidentiality (docs/DECISIONS.md): this checks ROLE
 * membership directly, never `hasPermission`. HOD and ADMIN hold the
 * `journal.edit`/`journal.manage` permissions (Stage 11 section 1), but
 * that permission is about issues/articles/settings, not manuscripts -
 * granting it must never silently widen manuscript access. Only the
 * SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF and JOURNAL_EDITOR *roles* bypass
 * every other check here.
 */
export function canReadManuscriptFile(
  user: SessionUser,
  file: ManuscriptFileAccessInput,
  reviewerAssignment: ReviewerAssignmentInput | null,
): boolean {
  if (!user.isActive) return false;

  if (hasRole(user, ["SUPER_ADMIN", "JOURNAL_EDITOR_IN_CHIEF", "JOURNAL_EDITOR"])) {
    return true;
  }

  if (hasRole(user, "AUTHOR") && file.manuscriptSubmittedById !== null) {
    if (file.manuscriptSubmittedById === user.id) return true;
  }

  if (hasRole(user, "REVIEWER") && reviewerAssignment && file.roundId !== null) {
    const matchesRound = reviewerAssignment.roundId === file.roundId;
    const statusAllows = REVIEWER_ALLOWED_STATUSES.includes(reviewerAssignment.status);
    const kindAllows = REVIEWER_ALLOWED_KINDS.includes(file.kind);
    if (matchesRound && statusAllows && kindAllows) return true;
  }

  return false;
}

export type DownloadDecision = { allowed: true; displayFilename: string } | { allowed: false; displayFilename: null };

/**
 * Same access check as above, but also decides the filename a caller
 * is shown: a reviewer always gets a generic `manuscript-round-N.pdf`
 * name (blind review - the real filename could itself reveal the
 * author), everyone else with access sees the real stored filename.
 */
export function canDownloadAs(
  user: SessionUser,
  file: ManuscriptFileAccessInput,
  reviewerAssignment: ReviewerAssignmentInput | null,
): DownloadDecision {
  if (!canReadManuscriptFile(user, file, reviewerAssignment)) {
    return { allowed: false, displayFilename: null };
  }

  const isReviewerOnly =
    hasRole(user, "REVIEWER") &&
    !hasRole(user, ["SUPER_ADMIN", "JOURNAL_EDITOR_IN_CHIEF", "JOURNAL_EDITOR"]) &&
    file.manuscriptSubmittedById !== user.id;

  if (isReviewerOnly) {
    return { allowed: true, displayFilename: `manuscript-round-${file.roundNumber ?? 1}.pdf` };
  }

  return { allowed: true, displayFilename: file.originalName };
}
