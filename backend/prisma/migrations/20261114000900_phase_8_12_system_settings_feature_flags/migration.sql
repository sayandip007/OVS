-- ============================================================================
-- Online Voting System (OVS) — Migration 20261114000900
-- Phase 8.12: System Settings, Platform Configuration, Feature Flags & Maintenance
-- ============================================================================

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');
CREATE TYPE "SettingCategory" AS ENUM ('PLATFORM', 'ELECTION_OPERATIONS', 'VOTING', 'SECURITY', 'NOTIFICATIONS', 'DEMO_SIMULATION');
CREATE TYPE "MaintenanceState" AS ENUM ('NORMAL', 'SCHEDULED_MAINTENANCE', 'MAINTENANCE_ACTIVE', 'READ_ONLY_MODE');

-- CreateTable system_settings
CREATE TABLE IF NOT EXISTS "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "category" "SettingCategory" NOT NULL DEFAULT 'PLATFORM',
    "value_type" "SettingValueType" NOT NULL DEFAULT 'STRING',
    "value" TEXT NOT NULL,
    "default_value" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "requires_restart" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable system_setting_history
CREATE TABLE IF NOT EXISTS "system_setting_history" (
    "id" UUID NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT NOT NULL,
    "change_reason" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_setting_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable feature_flags
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percentage" INTEGER NOT NULL DEFAULT 0,
    "target_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "updated_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateTable feature_flag_history
CREATE TABLE IF NOT EXISTS "feature_flag_history" (
    "id" UUID NOT NULL,
    "flag_key" VARCHAR(100) NOT NULL,
    "was_enabled" BOOLEAN NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    "rollout_percentage" INTEGER NOT NULL,
    "change_reason" TEXT NOT NULL,
    "admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flag_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable maintenance_schedules
CREATE TABLE IF NOT EXISTS "maintenance_schedules" (
    "id" UUID NOT NULL,
    "state" "MaintenanceState" NOT NULL DEFAULT 'NORMAL',
    "message" TEXT NOT NULL DEFAULT 'System maintenance in progress. Please check back later.',
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "activated_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "system_settings_category_idx" ON "system_settings"("category");
CREATE INDEX IF NOT EXISTS "system_setting_history_setting_key_version_idx" ON "system_setting_history"("setting_key", "version");
CREATE INDEX IF NOT EXISTS "system_setting_history_admin_id_created_at_idx" ON "system_setting_history"("admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "feature_flag_history_flag_key_created_at_idx" ON "feature_flag_history"("flag_key", "created_at");
CREATE INDEX IF NOT EXISTS "maintenance_schedules_state_start_at_end_at_idx" ON "maintenance_schedules"("state", "start_at", "end_at");

-- Foreign Keys
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "system_setting_history" ADD CONSTRAINT "system_setting_history_setting_key_fkey" FOREIGN KEY ("setting_key") REFERENCES "system_settings"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_setting_history" ADD CONSTRAINT "system_setting_history_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feature_flag_history" ADD CONSTRAINT "feature_flag_history_flag_key_fkey" FOREIGN KEY ("flag_key") REFERENCES "feature_flags"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feature_flag_history" ADD CONSTRAINT "feature_flag_history_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_activated_by_admin_id_fkey" FOREIGN KEY ("activated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
