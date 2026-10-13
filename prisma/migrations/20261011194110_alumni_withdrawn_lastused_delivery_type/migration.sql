-- AlterEnum
ALTER TYPE "AlumniStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "AlumniEntry" ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AlumniLink" ADD COLUMN     "lastUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "deliveryType" TEXT NOT NULL DEFAULT 'upload';
