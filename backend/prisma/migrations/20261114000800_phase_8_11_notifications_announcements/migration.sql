-- AlterEnum
ALTER TYPE "AnnouncementStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "AnnouncementStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "AnnouncementStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "approved_by_admin_id" UUID,
ADD COLUMN IF NOT EXISTS "review_notes" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_notifications" (
    "id" VARCHAR(50) NOT NULL,
    "admin_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERAL_ANNOUNCEMENT',
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "election_reminders" BOOLEAN NOT NULL DEFAULT true,
    "general_announcements" BOOLEAN NOT NULL DEFAULT true,
    "admin_alerts" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" VARCHAR(50),
    "announcement_id" VARCHAR(50),
    "recipient_user_id" UUID,
    "recipient_email" VARCHAR(255),
    "channel" VARCHAR(20) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMPTZ(6),
    "last_attempt_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_notifications_admin_id_is_read_idx" ON "admin_notifications"("admin_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_deliveries_status_next_retry_at_idx" ON "notification_deliveries"("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "notification_deliveries_recipient_user_id_idx" ON "notification_deliveries"("recipient_user_id");
CREATE INDEX IF NOT EXISTS "notification_deliveries_announcement_id_idx" ON "notification_deliveries"("announcement_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'announcements_approved_by_admin_id_fkey'
    ) THEN
        ALTER TABLE "announcements" ADD CONSTRAINT "announcements_approved_by_admin_id_fkey" FOREIGN KEY ("approved_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admin_notifications_admin_id_fkey'
    ) THEN
        ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_user_id_fkey'
    ) THEN
        ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
