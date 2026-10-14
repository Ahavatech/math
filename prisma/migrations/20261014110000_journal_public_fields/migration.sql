-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('RESEARCH_ARTICLE', 'REVIEW', 'SHORT_COMMUNICATION', 'OTHER');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "acceptedAt" DATE,
ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "receivedAt" DATE,
ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "type" "ArticleType" NOT NULL DEFAULT 'RESEARCH_ARTICLE',
ALTER COLUMN "issueId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ArticleAuthor" ADD COLUMN     "orcid" TEXT;

-- AlterTable
ALTER TABLE "EditorialBoardMember" ADD COLUMN     "affiliationCountry" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "orcid" TEXT,
ADD COLUMN     "photoId" TEXT;

-- AlterTable
ALTER TABLE "JournalIssue" ADD COLUMN     "description" TEXT;

-- AddForeignKey
ALTER TABLE "EditorialBoardMember" ADD CONSTRAINT "EditorialBoardMember_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

