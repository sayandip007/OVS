-- ============================================================================
-- OVS Phase 8.5 — Election Creation, Management & Lifecycle Control
-- ============================================================================

-- 1. Extend elections table with optimistic concurrency, jurisdiction metadata,
--    creator/updater attribution, cancellation metadata, and archival metadata.
ALTER TABLE "elections"
  ADD COLUMN "country" VARCHAR(100) NOT NULL DEFAULT 'India',
  ADD COLUMN "target_jurisdiction" VARCHAR(150) NOT NULL DEFAULT 'National',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "created_by_admin_id" UUID,
  ADD COLUMN "updated_by_admin_id" UUID,
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancelled_by_admin_id" UUID,
  ADD COLUMN "cancellation_reason" TEXT,
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "archived_by_admin_id" UUID,
  ADD COLUMN "archive_note" TEXT;

-- Backfill target_jurisdiction for existing STATE_ASSEMBLY records if any
UPDATE "elections"
   SET "target_jurisdiction" = COALESCE("state_id", 'State Assembly')
 WHERE "type" = 'STATE_ASSEMBLY' AND "target_jurisdiction" = 'National';

-- Foreign keys to admin_users (preserve historical election records if admin is removed)
ALTER TABLE "elections"
  ADD CONSTRAINT "elections_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_updated_by_admin_id_fkey"
  FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_cancelled_by_admin_id_fkey"
  FOREIGN KEY ("cancelled_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "elections"
  ADD CONSTRAINT "elections_archived_by_admin_id_fkey"
  FOREIGN KEY ("archived_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce election-type and state consistency at database level
ALTER TABLE "elections"
  ADD CONSTRAINT "chk_election_type_state_consistency"
  CHECK (
    ("type" = 'LOK_SABHA' AND "state_id" IS NULL)
    OR
    ("type" = 'STATE_ASSEMBLY' AND "state_id" IS NOT NULL)
  );

-- Enforce positive optimistic-concurrency version counter
ALTER TABLE "elections"
  ADD CONSTRAINT "chk_election_version_positive"
  CHECK ("version" >= 1);

-- Enforce cancellation reason & timestamp whenever status = CANCELLED
ALTER TABLE "elections"
  ADD CONSTRAINT "chk_election_cancelled_reason"
  CHECK (
    "status" <> 'CANCELLED'
    OR ("cancelled_at" IS NOT NULL AND "cancellation_reason" IS NOT NULL AND length(trim("cancellation_reason")) >= 5)
  );

-- Enforce archival timestamp whenever status = ARCHIVED
ALTER TABLE "elections"
  ADD CONSTRAINT "chk_election_archived_metadata"
  CHECK (
    "status" <> 'ARCHIVED'
    OR "archived_at" IS NOT NULL
  );

CREATE INDEX "elections_state_id_status_idx" ON "elections"("state_id", "status");

-- 2. Extend election_lifecycle_history with action classification and request correlation ID
ALTER TABLE "election_lifecycle_history"
  ADD COLUMN "action" VARCHAR(60) NOT NULL DEFAULT 'STATUS_TRANSITION',
  ADD COLUMN "request_id" VARCHAR(100);
