-- DropForeignKey
ALTER TABLE "ManuscriptEvent" DROP CONSTRAINT "ManuscriptEvent_actorId_fkey";

-- DropForeignKey
ALTER TABLE "ManuscriptEvent" DROP CONSTRAINT "ManuscriptEvent_manuscriptId_fkey";

-- AddForeignKey
ALTER TABLE "ManuscriptEvent" ADD CONSTRAINT "ManuscriptEvent_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManuscriptEvent" ADD CONSTRAINT "ManuscriptEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
