-- AlterTable: add createdAt to ReviewReminderLog
ALTER TABLE "ReviewReminderLog" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
