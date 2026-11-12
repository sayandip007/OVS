-- ============================================================================
-- OVS Phase 8.6 — Candidate Registration, Political Party & Nomination Lifecycle
-- ============================================================================

-- 1. Extend political_parties with description & case-insensitive abbreviation uniqueness
ALTER TABLE "political_parties"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "uq_political_parties_abbreviation_upper"
  ON "political_parties"(UPPER("abbreviation"));

-- 2. Extend candidates with display_name, is_active, and deactivated_at
ALTER TABLE "candidates"
  ADD COLUMN "display_name" VARCHAR(150),
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "deactivated_at" TIMESTAMPTZ(6);

CREATE INDEX "candidates_is_active_idx" ON "candidates"("is_active");

-- 3. Extend candidate_nominations with independent XOR guard, party snapshot,
--    optimistic concurrency version, and lifecycle attribution
ALTER TABLE "candidate_nominations"
  ADD COLUMN "is_independent" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "party_name_snapshot" VARCHAR(150),
  ADD COLUMN "party_abbreviation_snapshot" VARCHAR(20),
  ADD COLUMN "party_type_snapshot" "PartyType",
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN "submitted_by_admin_id" UUID,
  ADD COLUMN "decision_at" TIMESTAMPTZ(6),
  ADD COLUMN "decision_reason" TEXT,
  ADD COLUMN "withdrawn_at" TIMESTAMPTZ(6),
  ADD COLUMN "withdrawn_by_admin_id" UUID,
  ADD COLUMN "withdrawal_reason" TEXT,
  ADD COLUMN "created_by_admin_id" UUID;

-- Backfill existing independent nominations where party_id IS NULL
UPDATE "candidate_nominations"
   SET "is_independent" = TRUE
 WHERE "party_id" IS NULL;

-- Backfill party snapshot for existing party-affiliated nominations
UPDATE "candidate_nominations" n
   SET "party_name_snapshot" = p."name",
       "party_abbreviation_snapshot" = p."abbreviation",
       "party_type_snapshot" = p."party_type"
  FROM "political_parties" p
 WHERE n."party_id" = p."id"
   AND n."party_name_snapshot" IS NULL;

ALTER TABLE "candidate_nominations"
  ADD CONSTRAINT "chk_nomination_independent_party_xor"
  CHECK (
    ("is_independent" = TRUE AND "party_id" IS NULL)
    OR
    ("is_independent" = FALSE AND "party_id" IS NOT NULL)
  );

ALTER TABLE "candidate_nominations"
  ADD CONSTRAINT "chk_nomination_version_positive"
  CHECK ("version" >= 1);

ALTER TABLE "candidate_nominations"
  ADD CONSTRAINT "candidate_nominations_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "candidate_nominations"
  ADD CONSTRAINT "candidate_nominations_submitted_by_admin_id_fkey"
  FOREIGN KEY ("submitted_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "candidate_nominations"
  ADD CONSTRAINT "candidate_nominations_withdrawn_by_admin_id_fkey"
  FOREIGN KEY ("withdrawn_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Immutable Nomination Lifecycle History table
CREATE TABLE "nomination_lifecycle_history" (
    "id" UUID NOT NULL,
    "nomination_id" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "from_status" "CandidateNominationStatus" NOT NULL,
    "to_status" "CandidateNominationStatus" NOT NULL,
    "changed_by_admin_id" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',
    "request_id" VARCHAR(100),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "nomination_lifecycle_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nomination_lifecycle_history_nomination_id_changed_at_idx"
  ON "nomination_lifecycle_history"("nomination_id", "changed_at");

ALTER TABLE "nomination_lifecycle_history"
  ADD CONSTRAINT "nomination_lifecycle_history_nomination_id_fkey"
  FOREIGN KEY ("nomination_id") REFERENCES "candidate_nominations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nomination_lifecycle_history"
  ADD CONSTRAINT "nomination_lifecycle_history_changed_by_admin_id_fkey"
  FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
