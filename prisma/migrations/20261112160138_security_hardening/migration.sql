-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastFailedAlertAt" TIMESTAMP(3),
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecretEnc" TEXT;

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedSession" (
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "RevokedSession_expiresAt_idx" ON "RevokedSession"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_at_idx" ON "LoginAttempt"("key", "at");

-- CreateIndex
CREATE INDEX "LoginAttempt_at_idx" ON "LoginAttempt"("at");

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
