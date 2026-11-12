-- Match the rest of the schema: every table has a createdAt column.
ALTER TABLE "RevokedSession" RENAME COLUMN "revokedAt" TO "createdAt";
