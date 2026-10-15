-- Stage 12a part 2: New fields, models and indexes (after enum commit)
-- New enum values from 20261014120000 must be committed before this migration runs.

-- Add emailVerifiedAt to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- Backfill: users who already have a password hash are considered verified
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "passwordHash" IS NOT NULL AND "emailVerifiedAt" IS NULL;

-- Add new fields to Manuscript
ALTER TABLE "Manuscript"
  ADD COLUMN IF NOT EXISTS "reference" TEXT,
  ADD COLUMN IF NOT EXISTS "articleType" "ArticleType" NOT NULL DEFAULT 'RESEARCH_ARTICLE',
  ADD COLUMN IF NOT EXISTS "coverLetter" TEXT,
  ADD COLUMN IF NOT EXISTS "suggestedReviewers" JSONB,
  ADD COLUMN IF NOT EXISTS "excludedReviewers" JSONB,
  ADD COLUMN IF NOT EXISTS "anonymisedConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "agreementVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "agreementAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

-- Change Manuscript default status to INCOMPLETE (new drafts start incomplete)
ALTER TABLE "Manuscript" ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';

-- Add unique index on Manuscript.reference
CREATE UNIQUE INDEX IF NOT EXISTS "Manuscript_reference_key" ON "Manuscript"("reference");

-- Add indexes on Manuscript
CREATE INDEX IF NOT EXISTS "Manuscript_submittedById_idx" ON "Manuscript"("submittedById");
CREATE INDEX IF NOT EXISTS "Manuscript_handlingEditorId_idx" ON "Manuscript"("handlingEditorId");

-- Create ManuscriptEventType enum
DO $$ BEGIN
  CREATE TYPE "ManuscriptEventType" AS ENUM (
    'CREATED', 'SUBMITTED', 'FILE_ADDED', 'FILE_REMOVED',
    'EDITOR_ASSIGNED', 'RETURNED_TO_AUTHOR', 'RESUBMITTED',
    'DESK_REJECTED', 'APPROVED_FOR_REVIEW', 'WITHDRAWN', 'INTERNAL_NOTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create ManuscriptEvent table
CREATE TABLE IF NOT EXISTS "ManuscriptEvent" (
  "id"              TEXT NOT NULL,
  "manuscriptId"    TEXT NOT NULL,
  "type"            "ManuscriptEventType" NOT NULL,
  "actorId"         TEXT,
  "visibleToAuthor" BOOLEAN NOT NULL DEFAULT false,
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManuscriptEvent_pkey" PRIMARY KEY ("id")
);

-- ManuscriptEvent foreign keys
ALTER TABLE "ManuscriptEvent"
  ADD CONSTRAINT "ManuscriptEvent_manuscriptId_fkey"
    FOREIGN KEY ("manuscriptId") REFERENCES "Manuscript"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "ManuscriptEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL;

-- ManuscriptEvent index
CREATE INDEX IF NOT EXISTS "ManuscriptEvent_manuscriptId_createdAt_idx"
  ON "ManuscriptEvent"("manuscriptId", "createdAt");

-- Create JournalCounter table
CREATE TABLE IF NOT EXISTS "JournalCounter" (
  "year"  INTEGER NOT NULL,
  "value" INTEGER NOT NULL,
  CONSTRAINT "JournalCounter_pkey" PRIMARY KEY ("year")
);
