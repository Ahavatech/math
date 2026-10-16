-- CreateTable: ReviewReminderLog for idempotent reminder emails
CREATE TABLE "ReviewReminderLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReminderLog_assignmentId_milestone_key" ON "ReviewReminderLog"("assignmentId", "milestone");

-- CreateIndex
CREATE INDEX "ReviewReminderLog_assignmentId_idx" ON "ReviewReminderLog"("assignmentId");

-- AddForeignKey
ALTER TABLE "ReviewReminderLog" ADD CONSTRAINT "ReviewReminderLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ReviewAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
