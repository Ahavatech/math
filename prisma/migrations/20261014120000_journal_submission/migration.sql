-- Stage 12a: Journal submission schema additions
-- Generated offline (no live database); applies on top of 20261014110000_journal_public_fields.
-- Requires review before applying to a production database.
--
-- PostgreSQL requires that new enum values are committed before they can be referenced
-- in DEFAULT clauses, so this migration explicitly commits enum additions first.

-- Add EMAIL_VERIFY to UserTokenType enum (commit required before use in session 2)
ALTER TYPE "UserTokenType" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFY';

-- Add INCOMPLETE and RETURNED_TO_AUTHOR to ManuscriptStatus enum
ALTER TYPE "ManuscriptStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE';
ALTER TYPE "ManuscriptStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_AUTHOR';

-- Add TITLE_PAGE to ManuscriptFileKind enum
ALTER TYPE "ManuscriptFileKind" ADD VALUE IF NOT EXISTS 'TITLE_PAGE';
