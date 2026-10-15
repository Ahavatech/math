import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/rbac";
import { canDownloadAs, type ManuscriptFileAccessInput } from "@/server/services/manuscript-access";
import { privateStorage } from "@/lib/private-storage";
import { logAction, type AuditRequestContext } from "@/server/services/audit";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

export const manuscriptFileDownloadRateLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

export type FileDownloadDecision =
  | { allowed: true; storageKey: string; mimeType: string; displayFilename: string; auditRequired: boolean }
  | { allowed: false };

/**
 * Loads a ManuscriptFile, computes the caller's COI status, then defers
 * to the pure canDownloadAs policy. Never throws for "not found" or
 * "not allowed" — both return `{ allowed: false }`, so the route can
 * 404 identically either way and never leak which fileId values exist
 * (decision #59).
 *
 * COI is true when the requesting user is the submitter, or when their
 * user id or verified email appears in the manuscript's author list
 * (decision #59).
 */
/**
 * @param __testDb - TEST ONLY. Allows unit tests to inject the test-DB client.
 *   Production callers never pass this argument; the default is the global `db`.
 *   Grep for `__testDb` to verify no production call site passes it.
 */
export async function decideManuscriptFileDownload(
  user: SessionUser,
  fileId: string,
  __testDb: typeof db = db,
): Promise<FileDownloadDecision> {
  const file = await __testDb.manuscriptFile.findUnique({
    where: { id: fileId },
    include: {
      manuscript: {
        select: {
          submittedById: true,
          authors: { select: { email: true } },
        },
      },
      round: { select: { number: true } },
    },
  });
  if (!file) return { allowed: false };

  // Compute COI: submitter or email-matching author
  const userRecord = await __testDb.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerifiedAt: true },
  });
  const verifiedEmail = userRecord?.emailVerifiedAt ? userRecord.email : null;

  const conflictOfInterest =
    file.manuscript.submittedById === user.id ||
    (verifiedEmail !== null &&
      file.manuscript.authors.some(
        (a) => a.email !== null && a.email.toLowerCase() === verifiedEmail.toLowerCase(),
      ));

  const assignment = await __testDb.reviewAssignment.findFirst({
    where: { manuscriptId: file.manuscriptId, reviewerId: user.id },
    select: { roundId: true, status: true },
  });

  const accessInput: ManuscriptFileAccessInput = {
    id: file.id,
    kind: file.kind,
    roundId: file.roundId,
    roundNumber: file.round?.number ?? null,
    manuscriptId: file.manuscriptId,
    manuscriptSubmittedById: file.manuscript.submittedById,
    originalName: file.originalName,
  };

  const decision = canDownloadAs(user, accessInput, assignment ?? null, conflictOfInterest);
  if (!decision.allowed) return { allowed: false };

  return {
    allowed: true,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    displayFilename: decision.displayFilename,
    auditRequired: decision.auditRequired,
  };
}

/** Streams the file; writes an AuditLog row only when auditRequired (SUPER_ADMIN / HOD reads). */
export async function streamManuscriptFileDownload(
  decision: Extract<FileDownloadDecision, { allowed: true }>,
  actorId: string,
  fileId: string,
  context?: AuditRequestContext,
) {
  const stream = await privateStorage().openRead(decision.storageKey);
  if (decision.auditRequired) {
    await logAction(
      db,
      { actorId, action: "journal.manuscript_file.download", entityType: "ManuscriptFile", entityId: fileId, summary: "Downloaded a manuscript file" },
      context,
    );
  }
  return stream;
}
