-- ============================================================================
-- OVS Phase 8.7 — Election Constituency Assignment, Scheduling & Configuration
-- ============================================================================

-- 1. Enums
CREATE TYPE "ConstituencyAssignmentStatus" AS ENUM ('ACTIVE', 'REMOVED');

CREATE TYPE "ScheduleMilestoneType" AS ENUM (
  'ELECTION_ANNOUNCEMENT',
  'NOMINATION_OPEN',
  'NOMINATION_DEADLINE',
  'NOMINATION_SCRUTINY',
  'WITHDRAWAL_DEADLINE',
  'FINAL_CANDIDATE_LIST',
  'CAMPAIGN_START',
  'CAMPAIGN_END',
  'POLLING_START',
  'POLLING_END',
  'COUNTING_START',
  'RESULT_REVIEW',
  'RESULT_PUBLICATION'
);

CREATE TYPE "ScheduleMilestoneStatus" AS ENUM ('DRAFT', 'CONFIGURED', 'COMPLETED');

CREATE TYPE "ConfigurationReviewStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED_FOR_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'CHANGES_REQUESTED'
);

-- 2. Extend elections for timezone, schedule optimistic concurrency, and config review workflow
ALTER TABLE "elections"
  ADD COLUMN "schedule_timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN "schedule_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "config_review_status" "ConfigurationReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "config_submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN "config_submitted_by_admin_id" UUID,
  ADD COLUMN "config_reviewed_at" TIMESTAMPTZ(6),
  ADD COLUMN "config_reviewed_by_admin_id" UUID,
  ADD COLUMN "config_approved_at" TIMESTAMPTZ(6),
  ADD COLUMN "config_approved_by_admin_id" UUID,
  ADD COLUMN "config_review_note" TEXT;

ALTER TABLE "elections"
  ADD CONSTRAINT "chk_election_schedule_version_positive"
  CHECK ("schedule_version" >= 1);

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_config_submitted_by_admin_id_fkey"
  FOREIGN KEY ("config_submitted_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_config_reviewed_by_admin_id_fkey"
  FOREIGN KEY ("config_reviewed_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_config_approved_by_admin_id_fkey"
  FOREIGN KEY ("config_approved_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Extend election_constituencies with status, assigner, metadata & updated_at
ALTER TABLE "election_constituencies"
  ADD COLUMN "status" "ConstituencyAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "assigned_by_admin_id" UUID,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "election_constituencies"
  ADD CONSTRAINT "election_constituencies_assigned_by_admin_id_fkey"
  FOREIGN KEY ("assigned_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Immutable election_constituency_history
CREATE TABLE "election_constituency_history" (
  "id" UUID NOT NULL,
  "election_id" VARCHAR(50) NOT NULL,
  "action" VARCHAR(60) NOT NULL,
  "constituency_type" "ConstituencyType" NOT NULL,
  "constituency_id" VARCHAR(50) NOT NULL,
  "changed_by_admin_id" UUID,
  "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT NOT NULL DEFAULT '',
  "request_id" VARCHAR(100),
  "metadata" JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT "election_constituency_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "election_constituency_history_election_id_changed_at_idx"
  ON "election_constituency_history"("election_id", "changed_at");

ALTER TABLE "election_constituency_history"
  ADD CONSTRAINT "election_constituency_history_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_constituency_history"
  ADD CONSTRAINT "election_constituency_history_changed_by_admin_id_fkey"
  FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Structured election_schedule_milestones (UTC timestamps + explicit timezone)
CREATE TABLE "election_schedule_milestones" (
  "id" UUID NOT NULL,
  "election_id" VARCHAR(50) NOT NULL,
  "milestone_type" "ScheduleMilestoneType" NOT NULL,
  "start_at" TIMESTAMPTZ(6),
  "end_at" TIMESTAMPTZ(6),
  "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
  "status" "ScheduleMilestoneStatus" NOT NULL DEFAULT 'DRAFT',
  "note" TEXT NOT NULL DEFAULT '',
  "created_by_admin_id" UUID,
  "updated_by_admin_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "election_schedule_milestones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_schedule_milestone_start_before_end"
    CHECK ("start_at" IS NULL OR "end_at" IS NULL OR "start_at" <= "end_at")
);

CREATE UNIQUE INDEX "election_schedule_milestones_election_id_milestone_type_key"
  ON "election_schedule_milestones"("election_id", "milestone_type");

CREATE INDEX "election_schedule_milestones_election_id_idx"
  ON "election_schedule_milestones"("election_id");

ALTER TABLE "election_schedule_milestones"
  ADD CONSTRAINT "election_schedule_milestones_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_schedule_milestones"
  ADD CONSTRAINT "election_schedule_milestones_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "election_schedule_milestones"
  ADD CONSTRAINT "election_schedule_milestones_updated_by_admin_id_fkey"
  FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Immutable election_schedule_history
CREATE TABLE "election_schedule_history" (
  "id" UUID NOT NULL,
  "election_id" VARCHAR(50) NOT NULL,
  "action" VARCHAR(60) NOT NULL,
  "changed_by_admin_id" UUID,
  "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT NOT NULL DEFAULT '',
  "request_id" VARCHAR(100),
  "metadata" JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT "election_schedule_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "election_schedule_history_election_id_changed_at_idx"
  ON "election_schedule_history"("election_id", "changed_at");

ALTER TABLE "election_schedule_history"
  ADD CONSTRAINT "election_schedule_history_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "election_schedule_history"
  ADD CONSTRAINT "election_schedule_history_changed_by_admin_id_fkey"
  FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
