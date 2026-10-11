import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { AuditRequestContext } from "./audit";
import { createLecturer, sendLecturerInvite } from "./lecturers";
import type { ValidImportRow } from "@/lib/lecturer-import";

export type BulkCreateResult =
  | { row: number; success: true; userId: string; profileId: string }
  | { row: number; success: false; error: string };

/** Step 2 of the CSV import: creates each row's account and DRAFT profile. Sends no email. */
export async function bulkCreateLecturers(
  db: PrismaClient,
  actorId: string,
  rows: ValidImportRow[],
  context?: AuditRequestContext,
): Promise<BulkCreateResult[]> {
  const results: BulkCreateResult[] = [];
  for (const row of rows) {
    try {
      const { user, profile } = await createLecturer(
        db,
        actorId,
        { fullName: row.fullName, honorific: row.honorific, rank: row.rank, email: row.email },
        context,
      );
      results.push({ row: row.row, success: true, userId: user.id, profileId: profile.id });
    } catch (error) {
      results.push({ row: row.row, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return results;
}

export type BulkInviteResult =
  | { userId: string; success: true }
  | { userId: string; success: false; error: string };

const DELAY_MS = 300;
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Step 3 of the CSV import: sends invites sequentially with a small delay, never aborting on one failure. */
export async function bulkSendInvites(
  db: PrismaClient,
  actorId: string,
  userIds: string[],
  context?: AuditRequestContext,
): Promise<BulkInviteResult[]> {
  const results: BulkInviteResult[] = [];
  for (const userId of userIds) {
    try {
      await sendLecturerInvite(db, actorId, userId, context);
      results.push({ userId, success: true });
    } catch (error) {
      results.push({ userId, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
    await delay(DELAY_MS);
  }
  return results;
}
