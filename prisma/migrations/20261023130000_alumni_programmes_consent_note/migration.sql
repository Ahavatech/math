-- Stage 12d: alumni multi-programme, consent public display, note field
-- Additive migration; existing dev rows are migrated sensibly.

-- 1. Add PHD to AlumniLevel enum
ALTER TYPE "AlumniLevel" ADD VALUE IF NOT EXISTS 'PHD';

-- 2. Create AlumniProgramme table
CREATE TABLE "AlumniProgramme" (
    "id"             TEXT NOT NULL,
    "alumnusId"      TEXT NOT NULL,
    "level"          "AlumniLevel" NOT NULL,
    "entryYear"      INTEGER,
    "graduationYear" INTEGER NOT NULL,
    CONSTRAINT "AlumniProgramme_pkey" PRIMARY KEY ("id")
);

-- 3. Migrate existing AlumniEntry rows: copy flat level+graduationYear into AlumniProgramme
INSERT INTO "AlumniProgramme" ("id", "alumnusId", "level", "graduationYear")
SELECT gen_random_uuid()::TEXT, "id", "level", "graduationYear"
FROM "AlumniEntry";

-- 4. Add new columns to AlumniEntry
ALTER TABLE "AlumniEntry"
    ADD COLUMN "roleOrField"          TEXT,
    ADD COLUMN "note"                 TEXT,
    ADD COLUMN "consentPublicDisplay" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN "isDuplicateEmail"     BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Migrate existing data: set consentPublicDisplay=true for rows that already have consent
--    (Stage 09 consent text included public display implicitly)
UPDATE "AlumniEntry" SET "consentPublicDisplay" = TRUE WHERE "consentAt" IS NOT NULL;

-- 6. Copy roleTitle → roleOrField
UPDATE "AlumniEntry" SET "roleOrField" = "roleTitle" WHERE "roleTitle" IS NOT NULL;

-- 7. Drop old flat columns from AlumniEntry
ALTER TABLE "AlumniEntry"
    DROP COLUMN "level",
    DROP COLUMN "graduationYear",
    DROP COLUMN "roleTitle";

-- 8. Indexes
CREATE UNIQUE INDEX "AlumniProgramme_alumnusId_level_key" ON "AlumniProgramme"("alumnusId", "level");
CREATE INDEX "AlumniProgramme_graduationYear_idx" ON "AlumniProgramme"("graduationYear");
CREATE INDEX "AlumniProgramme_level_graduationYear_idx" ON "AlumniProgramme"("level", "graduationYear");

-- 9. Foreign key from AlumniProgramme to AlumniEntry
ALTER TABLE "AlumniProgramme"
    ADD CONSTRAINT "AlumniProgramme_alumnusId_fkey"
    FOREIGN KEY ("alumnusId") REFERENCES "AlumniEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. Add email index to AlumniEntry (for duplicate-email checks)
CREATE INDEX "AlumniEntry_email_idx" ON "AlumniEntry"("email");
