-- AlterTable
ALTER TABLE "AcademicCalendarEntry" ALTER COLUMN "startDate" SET DATA TYPE DATE,
ALTER COLUMN "endDate" DROP NOT NULL,
ALTER COLUMN "endDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isElective" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "programmeLevel" "ProgrammeLevel" NOT NULL,
ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Download" ADD COLUMN     "uploadedById" TEXT;

-- AlterTable
ALTER TABLE "HandbookPage" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "summary" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_programmeLevel_idx" ON "Course"("programmeLevel");

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

