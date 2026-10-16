import { describe, it, expect } from "vitest";
import { db as prodDb } from "@/lib/db";

const db = process.env.TEST_DATABASE_URL ? prodDb : null;

describe.skipIf(db === null)("schema-migration: journal_peer_review", () => {
  it("ReviewAssignment has tokenHash and invitedById columns", async () => {
    const cols = await db!.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ReviewAssignment'
      ORDER BY column_name`;
    const names = cols.map((c) => c.column_name);
    expect(names).toContain("tokenHash");
    expect(names).toContain("invitedById");
    expect(names).toContain("declineReason");
  });

  it("ReviewerProfile table exists", async () => {
    const result = await db!.reviewerProfile.count();
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("Review has isDraft and HTML comment columns", async () => {
    const cols = await db!.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Review'
      ORDER BY column_name`;
    const names = cols.map((c) => c.column_name);
    expect(names).toContain("isDraft");
    expect(names).toContain("commentsToAuthorHtml");
    expect(names).toContain("commentsToEditorHtml");
  });

  it("EditorialDecision has letterHtml, decidedAt, emailSentAt columns", async () => {
    const cols = await db!.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'EditorialDecision'
      ORDER BY column_name`;
    const names = cols.map((c) => c.column_name);
    expect(names).toContain("letterHtml");
    expect(names).toContain("decidedAt");
    expect(names).toContain("emailSentAt");
  });

  it("ReviewAssignmentStatus includes REVOKED", async () => {
    const result = await db!.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'ReviewAssignmentStatus'
      )`;
    const labels = result.map((r) => r.enumlabel);
    expect(labels).toContain("REVOKED");
  });

  it("ManuscriptFileKind includes REVIEW_ATTACHMENT", async () => {
    const result = await db!.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'ManuscriptFileKind'
      )`;
    const labels = result.map((r) => r.enumlabel);
    expect(labels).toContain("REVIEW_ATTACHMENT");
  });

  it("ManuscriptEventType includes REVIEWER_INVITED and REVIEW_SUBMITTED", async () => {
    const result = await db!.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'ManuscriptEventType'
      )`;
    const labels = result.map((r) => r.enumlabel);
    expect(labels).toContain("REVIEWER_INVITED");
    expect(labels).toContain("REVIEW_SUBMITTED");
    expect(labels).toContain("DECISION_RECORDED");
    expect(labels).toContain("REVISION_REQUESTED");
  });
});
