-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
