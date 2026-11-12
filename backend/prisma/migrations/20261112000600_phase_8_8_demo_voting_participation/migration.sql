-- Phase 8.8: Demo Voting, Ballot Presentation & Voter Participation Management
-- Preserves zero candidate/party storage in demo_participations while recording
-- the voter's election-scoped constituency (PC or AC) cleanly with strict XOR integrity.

ALTER TYPE "ParticipationStatus" ADD VALUE IF NOT EXISTS 'PARTICIPATED';

ALTER TABLE "demo_participations"
  ADD COLUMN IF NOT EXISTS "constituency_type" "ConstituencyType",
  ADD COLUMN IF NOT EXISTS "parliamentary_constituency_id" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "assembly_constituency_id" VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'demo_participations_parliamentary_constituency_id_fkey'
  ) THEN
    ALTER TABLE "demo_participations"
      ADD CONSTRAINT "demo_participations_parliamentary_constituency_id_fkey"
      FOREIGN KEY ("parliamentary_constituency_id") REFERENCES "parliamentary_constituencies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'demo_participations_assembly_constituency_id_fkey'
  ) THEN
    ALTER TABLE "demo_participations"
      ADD CONSTRAINT "demo_participations_assembly_constituency_id_fkey"
      FOREIGN KEY ("assembly_constituency_id") REFERENCES "assembly_constituencies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_demo_participation_constituency_xor'
  ) THEN
    ALTER TABLE "demo_participations"
      ADD CONSTRAINT "chk_demo_participation_constituency_xor"
      CHECK (
        ("constituency_type" IS NULL AND "parliamentary_constituency_id" IS NULL AND "assembly_constituency_id" IS NULL)
        OR ("constituency_type" = 'PARLIAMENTARY' AND "parliamentary_constituency_id" IS NOT NULL AND "assembly_constituency_id" IS NULL)
        OR ("constituency_type" = 'ASSEMBLY' AND "assembly_constituency_id" IS NOT NULL AND "parliamentary_constituency_id" IS NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "demo_participations_election_id_constituency_type_idx"
  ON "demo_participations"("election_id", "constituency_type");
CREATE INDEX IF NOT EXISTS "demo_participations_election_id_parliamentary_constituency_id_idx"
  ON "demo_participations"("election_id", "parliamentary_constituency_id");
CREATE INDEX IF NOT EXISTS "demo_participations_election_id_assembly_constituency_id_idx"
  ON "demo_participations"("election_id", "assembly_constituency_id");
