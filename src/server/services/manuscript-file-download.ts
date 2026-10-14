import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/rbac";
import { canDownloadAs, type ManuscriptFileAccessInput } from "@/server/services/manuscript-access";
import { privateStorage } from "@/lib/private-storage";
import { logAction, type AuditRequestContext } from "@/server/services/audit";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

export const manuscriptFileDownloadRateLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

export type FileDownloadDecision =
  | { allowed: true; storageKey: string; mimeType: string; displayFilename: string }
  | { allowed: false };

/**
 * Loads a ManuscriptFile plus the caller's own review assignment for its
 * manuscript (if any), then defers to the pure canDownloadAs policy.
 * Never throws for "not found" or "not allowed" - both return
 * `{ allowed: false }`, so the route can 404 identically either way and
 * never leak which fileId values exist.
 */
export async function decideManuscriptFileDownload(
  user: SessionUser,
  fileId: string,
): Promise<FileDownloadDecision> {
  const file = await db.manuscriptFile.findUnique({
    where: { id: fileId },
    include: { manuscript: { select: { submittedById: true } }, round: { select: { number: true } } },
  });
  if (!file) return { allowed: false };

  const assignment = await db.reviewAssignment.findFirst({
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

  const decision = canDownloadAs(user, accessInput, assignment ?? null);
  if (!decision.allowed) return { allowed: false };

  return {
    allowed: true,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    displayFilename: decision.displayFilename,
  };
}

/** Streams the file and writes exactly one AuditLog row (actor + file id, no names). */
export async function streamManuscriptFileDownload(
  decision: Extract<FileDownloadDecision, { allowed: true }>,
  actorId: string,
  fileId: string,
  context?: AuditRequestContext,
) {
  const stream = await privateStorage().openRead(decision.storageKey);
  await logAction(
    db,
    { actorId, action: "journal.manuscript_file.download", entityType: "ManuscriptFile", entityId: fileId, summary: "Downloaded a manuscript file" },
    context,
  );
  return stream;
}
