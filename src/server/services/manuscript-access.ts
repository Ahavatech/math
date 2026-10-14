import "server-only";
import type { ManuscriptFileKind, ReviewAssignmentStatus } from "@prisma/client";
import { hasRole, hasPermission, type SessionUser } from "@/lib/rbac";

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

// Roles that have read access to manuscripts (decisions #58, #59).
// ADMIN is deliberately absent (decision #54: editorial independence).
const EDITORIAL_READ_ROLES = ["SUPER_ADMIN", "JOURNAL_EDITOR_IN_CHIEF", "JOURNAL_EDITOR"] as const;
// HOD has journal.manuscripts.read but no editorial actions.
const HOD_ROLE = "HOD" as const;
// Roles that require an audit log entry on file access (decision #60).
const AUDIT_REQUIRED_ROLES = ["SUPER_ADMIN", "HOD"] as const;

/**
 * Access policy for individual manuscript files.
 *
 * `conflictOfInterest` — caller computes this: true when the requesting
 * user submitted the manuscript, or when their user id / verified email
 * matches any author email on it. COI denies editorial and HOD access
 * regardless of roles (decision #59).
 *
 * Returns a boolean: allowed or not.
 * Use canReadManuscriptFileWithAudit when you also need the auditRequired flag.
 */
export function canReadManuscriptFile(
  user: SessionUser,
  file: ManuscriptFileAccessInput,
  reviewerAssignment: ReviewerAssignmentInput | null,
  conflictOfInterest: boolean,
): boolean {
  return canReadManuscriptFileWithAudit(user, file, reviewerAssignment, conflictOfInterest).allowed;
}

export interface ManuscriptFileAccessResult {
  allowed: boolean;
  auditRequired: boolean;
}

/**
 * Full policy check. Returns `{ allowed, auditRequired }`.
 * `auditRequired` is true for SUPER_ADMIN and HOD successful reads (decision #60).
 */
export function canReadManuscriptFileWithAudit(
  user: SessionUser,
  file: ManuscriptFileAccessInput,
  reviewerAssignment: ReviewerAssignmentInput | null,
  conflictOfInterest: boolean,
): ManuscriptFileAccessResult {
  const deny: ManuscriptFileAccessResult = { allowed: false, auditRequired: false };
  if (!user.isActive) return deny;

  // Editorial / SUPER_ADMIN access — blocked by COI and TITLE_PAGE is always allowed for editors
  if (hasRole(user, [...EDITORIAL_READ_ROLES])) {
    if (conflictOfInterest) return deny;
    return {
      allowed: true,
      auditRequired: hasRole(user, [...AUDIT_REQUIRED_ROLES]),
    };
  }

  // HOD: read-only, no TITLE_PAGE, blocked by COI (decision #58, #59, #60)
  if (hasRole(user, HOD_ROLE)) {
    if (conflictOfInterest) return deny;
    if (file.kind === "TITLE_PAGE") return deny;
    return { allowed: true, auditRequired: true };
  }

  // Submitting author always reads their own manuscript (COI does not block own work)
  if (hasRole(user, "AUTHOR") && file.manuscriptSubmittedById !== null) {
    if (file.manuscriptSubmittedById === user.id) return { allowed: true, auditRequired: false };
  }

  // Reviewer: no TITLE_PAGE; must have active assignment in the same round
  if (hasRole(user, "REVIEWER") && reviewerAssignment && file.roundId !== null) {
    if (file.kind === "TITLE_PAGE") return deny;
    const matchesRound = reviewerAssignment.roundId === file.roundId;
    const statusAllows = REVIEWER_ALLOWED_STATUSES.includes(reviewerAssignment.status);
    const kindAllows = REVIEWER_ALLOWED_KINDS.includes(file.kind);
    if (matchesRound && statusAllows && kindAllows) return { allowed: true, auditRequired: false };
  }

  return deny;
}

export type DownloadDecision = { allowed: true; displayFilename: string; auditRequired: boolean } | { allowed: false; displayFilename: null };

/**
 * Same access check as canReadManuscriptFileWithAudit, but also decides
 * the filename shown to the caller. A reviewer always gets a generic
 * `manuscript-round-N.pdf` name (blind review); everyone else with
 * access sees the real stored filename.
 */
export function canDownloadAs(
  user: SessionUser,
  file: ManuscriptFileAccessInput,
  reviewerAssignment: ReviewerAssignmentInput | null,
  conflictOfInterest: boolean,
): DownloadDecision {
  const result = canReadManuscriptFileWithAudit(user, file, reviewerAssignment, conflictOfInterest);
  if (!result.allowed) return { allowed: false, displayFilename: null };

  const isReviewerOnly =
    hasRole(user, "REVIEWER") &&
    !hasRole(user, [...EDITORIAL_READ_ROLES, HOD_ROLE]) &&
    file.manuscriptSubmittedById !== user.id;

  if (isReviewerOnly) {
    return {
      allowed: true,
      displayFilename: `manuscript-round-${file.roundNumber ?? 1}.pdf`,
      auditRequired: result.auditRequired,
    };
  }

  return { allowed: true, displayFilename: file.originalName, auditRequired: result.auditRequired };
}
