-- AlterTable
ALTER TABLE "LecturerProfile" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "publishRequestedAt" TIMESTAMP(3),
ADD COLUMN     "supervisionText" TEXT;
