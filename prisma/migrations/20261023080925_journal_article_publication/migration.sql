/*
  Warnings:

  - The `status` column on the `Article` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CORRECTED', 'RETRACTED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "articleNumber" INTEGER,
ADD COLUMN     "finalPdfSha256" TEXT,
ADD COLUMN     "notices" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "retractionReason" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "subjectArea" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "ArticleAuthor" ADD COLUMN     "isCorresponding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReviewerProfile" ADD COLUMN     "acknowledgementOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");
