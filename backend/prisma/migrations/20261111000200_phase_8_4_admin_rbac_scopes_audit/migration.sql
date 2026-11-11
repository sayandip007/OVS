-- ============================================================================
-- OVS Phase 8.4 — Admin Authentication, RBAC, Jurisdiction Scoping & Audit
-- ============================================================================

-- 1. Create AdminStatus Enum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- 2. Extend UserSession with activity timestamp for inactivity expiry tracking
ALTER TABLE "user_sessions"
  ADD COLUMN "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. Extend AdminUser with normalized email, lifecycle status, suspension metadata, and provisioning lineage
ALTER TABLE "admin_users"
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspended_at" TIMESTAMPTZ(6),
  ADD COLUMN "suspended_reason" TEXT,
  ADD COLUMN "deactivated_at" TIMESTAMPTZ(6),
  ADD COLUMN "created_by_admin_id" UUID,
  ADD COLUMN "password_updated_at" TIMESTAMPTZ(6);

-- Safe backfill if existing rows are present in upgrade environments
UPDATE "admin_users"
   SET "email" = LOWER("officer_code") || '@ovs-demo.local'
 WHERE "email" IS NULL;

ALTER TABLE "admin_users"
  ALTER COLUMN "email" SET NOT NULL;

CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX "admin_users_role_status_idx" ON "admin_users"("role", "status");
CREATE INDEX "admin_users_assigned_state_id_idx" ON "admin_users"("assigned_state_id");

ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_users"
  ADD CONSTRAINT "chk_admin_status_active_sync"
  CHECK (
    ("status" = 'ACTIVE' AND "is_active" = TRUE)
    OR
    ("status" IN ('SUSPENDED', 'DEACTIVATED') AND "is_active" = FALSE)
  );

-- 4. Multi-State Jurisdiction Scope Table (supports STATE_ADMIN assigned 1..N states)
CREATE TABLE "admin_state_scopes" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "state_id" VARCHAR(10) NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_admin_id" UUID,

    CONSTRAINT "admin_state_scopes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_state_scopes_admin_user_id_idx" ON "admin_state_scopes"("admin_user_id");
CREATE INDEX "admin_state_scopes_state_id_idx" ON "admin_state_scopes"("state_id");
CREATE UNIQUE INDEX "admin_state_scopes_admin_user_id_state_id_key" ON "admin_state_scopes"("admin_user_id", "state_id");

ALTER TABLE "admin_state_scopes"
  ADD CONSTRAINT "admin_state_scopes_admin_user_id_fkey"
  FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_state_scopes"
  ADD CONSTRAINT "admin_state_scopes_state_id_fkey"
  FOREIGN KEY ("state_id") REFERENCES "states"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_state_scopes"
  ADD CONSTRAINT "admin_state_scopes_assigned_by_admin_id_fkey"
  FOREIGN KEY ("assigned_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Constituency Jurisdiction Scope Table (supports ELECTION_OFFICER scoped to specific PC/ACs)
CREATE TABLE "admin_constituency_scopes" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "election_id" VARCHAR(50),
    "constituency_type" "ConstituencyType" NOT NULL,
    "parliamentary_constituency_id" VARCHAR(50),
    "assembly_constituency_id" VARCHAR(50),
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_admin_id" UUID,

    CONSTRAINT "admin_constituency_scopes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_constituency_scopes_admin_user_id_idx" ON "admin_constituency_scopes"("admin_user_id");
CREATE INDEX "admin_constituency_scopes_election_id_idx" ON "admin_constituency_scopes"("election_id");
CREATE INDEX "admin_constituency_scopes_parliamentary_constituency_id_idx" ON "admin_constituency_scopes"("parliamentary_constituency_id");
CREATE INDEX "admin_constituency_scopes_assembly_constituency_id_idx" ON "admin_constituency_scopes"("assembly_constituency_id");

ALTER TABLE "admin_constituency_scopes"
  ADD CONSTRAINT "chk_admin_constituency_scope_target"
  CHECK (
    ("constituency_type" = 'PARLIAMENTARY' AND "parliamentary_constituency_id" IS NOT NULL AND "assembly_constituency_id" IS NULL)
    OR
    ("constituency_type" = 'ASSEMBLY' AND "assembly_constituency_id" IS NOT NULL AND "parliamentary_constituency_id" IS NULL)
  );

CREATE UNIQUE INDEX "uq_admin_constituency_scope_pc"
  ON "admin_constituency_scopes"("admin_user_id", COALESCE("election_id", ''), "parliamentary_constituency_id")
  WHERE "parliamentary_constituency_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_admin_constituency_scope_ac"
  ON "admin_constituency_scopes"("admin_user_id", COALESCE("election_id", ''), "assembly_constituency_id")
  WHERE "assembly_constituency_id" IS NOT NULL;

ALTER TABLE "admin_constituency_scopes"
  ADD CONSTRAINT "admin_constituency_scopes_admin_user_id_fkey"
  FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_constituency_scopes"
  ADD CONSTRAINT "admin_constituency_scopes_election_id_fkey"
  FOREIGN KEY ("election_id") REFERENCES "elections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_constituency_scopes"
  ADD CONSTRAINT "admin_constituency_scopes_parliamentary_constituency_id_fkey"
  FOREIGN KEY ("parliamentary_constituency_id") REFERENCES "parliamentary_constituencies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_constituency_scopes"
  ADD CONSTRAINT "admin_constituency_scopes_assembly_constituency_id_fkey"
  FOREIGN KEY ("assembly_constituency_id") REFERENCES "assembly_constituencies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_constituency_scopes"
  ADD CONSTRAINT "admin_constituency_scopes_assigned_by_admin_id_fkey"
  FOREIGN KEY ("assigned_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Extend AdminActionLog for comprehensive security event attribution & request correlation
ALTER TABLE "admin_action_logs"
  ADD COLUMN "actor_user_id" UUID,
  ADD COLUMN "actor_identifier" VARCHAR(100),
  ADD COLUMN "actor_role" "AdminRole",
  ADD COLUMN "outcome" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "request_id" VARCHAR(100),
  ADD COLUMN "user_agent" TEXT;

ALTER TABLE "admin_action_logs"
  ADD CONSTRAINT "chk_admin_action_log_outcome"
  CHECK ("outcome" IN ('SUCCESS', 'FAILURE', 'DENIED'));

CREATE INDEX "admin_action_logs_admin_user_id_timestamp_idx" ON "admin_action_logs"("admin_user_id", "timestamp");
CREATE INDEX "admin_action_logs_outcome_timestamp_idx" ON "admin_action_logs"("outcome", "timestamp");
