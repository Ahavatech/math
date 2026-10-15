-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVIEWER_INVITED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVIEWER_ACCEPTED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVIEWER_DECLINED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVIEWER_REVOKED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVIEWER_EXPIRED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVIEWER_REMINDER_SENT';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVIEW_SUBMITTED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'DECISION_RECORDED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'REVISION_REQUESTED';
ALTER TYPE "ManuscriptEventType" ADD VALUE 'ROUND_CREATED';

-- AlterEnum
ALTER TYPE "ManuscriptFileKind" ADD VALUE 'REVIEW_ATTACHMENT';

-- AlterEnum
ALTER TYPE "ReviewAssignmentStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "EditorialDecision" ADD COLUMN     "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "letterHtml" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "commentsToAuthorHtml" TEXT,
ADD COLUMN     "commentsToEditorHtml" TEXT,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "recommendation" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReviewAssignment" ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "tokenHash" TEXT;

-- CreateTable
CREATE TABLE "ReviewerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expertiseTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerProfile_userId_key" ON "ReviewerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAssignment_tokenHash_key" ON "ReviewAssignment"("tokenHash");

-- CreateIndex
CREATE INDEX "ReviewAssignment_invitedById_idx" ON "ReviewAssignment"("invitedById");

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerProfile" ADD CONSTRAINT "ReviewerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
