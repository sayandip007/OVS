-- ============================================================================
-- OVS Phase 8.2 — Custom Database Integrity Migration
-- Applies CHECK constraints, Partial Unique Indexes, and PL/pgSQL Triggers
-- aligned with docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql
-- ============================================================================

-- 1. Exclusivity CHECK Constraints for Constituency Polymorphism
ALTER TABLE "election_constituencies"
  ADD CONSTRAINT "chk_election_constituency_target"
  CHECK (
    ("constituency_type" = 'PARLIAMENTARY' AND "parliamentary_constituency_id" IS NOT NULL AND "assembly_constituency_id" IS NULL)
    OR
    ("constituency_type" = 'ASSEMBLY' AND "assembly_constituency_id" IS NOT NULL AND "parliamentary_constituency_id" IS NULL)
  );

ALTER TABLE "candidate_nominations"
  ADD CONSTRAINT "chk_nomination_constituency_target"
  CHECK (
    ("constituency_type" = 'PARLIAMENTARY' AND "parliamentary_constituency_id" IS NOT NULL AND "assembly_constituency_id" IS NULL)
    OR
    ("constituency_type" = 'ASSEMBLY' AND "assembly_constituency_id" IS NOT NULL AND "parliamentary_constituency_id" IS NULL)
  );

ALTER TABLE "counting_sessions"
  ADD CONSTRAINT "chk_counting_session_constituency_target"
  CHECK (
    ("constituency_type" = 'PARLIAMENTARY' AND "parliamentary_constituency_id" IS NOT NULL AND "assembly_constituency_id" IS NULL)
    OR
    ("constituency_type" = 'ASSEMBLY' AND "assembly_constituency_id" IS NOT NULL AND "parliamentary_constituency_id" IS NULL)
  );

-- 2. Partial Unique Indexes for Nullable Constituency Targets
CREATE UNIQUE INDEX "uq_election_constituency_pc"
  ON "election_constituencies" ("election_id", "parliamentary_constituency_id")
  WHERE "parliamentary_constituency_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_election_constituency_ac"
  ON "election_constituencies" ("election_id", "assembly_constituency_id")
  WHERE "assembly_constituency_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_nomination_candidate_pc"
  ON "candidate_nominations" ("election_id", "candidate_id", "parliamentary_constituency_id")
  WHERE "parliamentary_constituency_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_nomination_candidate_ac"
  ON "candidate_nominations" ("election_id", "candidate_id", "assembly_constituency_id")
  WHERE "assembly_constituency_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_counting_session_pc"
  ON "counting_sessions" ("election_id", "parliamentary_constituency_id")
  WHERE "parliamentary_constituency_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_counting_session_ac"
  ON "counting_sessions" ("election_id", "assembly_constituency_id")
  WHERE "assembly_constituency_id" IS NOT NULL;

-- 3. Trigger: Verify ElectionConstituency Type & State Consistency
CREATE OR REPLACE FUNCTION verify_election_constituency_mapping()
RETURNS TRIGGER AS $$
DECLARE
  v_election_type "ElectionType";
  v_election_state_id VARCHAR(10);
  v_target_state_id VARCHAR(10);
BEGIN
  SELECT "type", "state_id"
    INTO v_election_type, v_election_state_id
    FROM "elections"
   WHERE "id" = NEW."election_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Election % does not exist.', NEW."election_id";
  END IF;

  IF v_election_type = 'LOK_SABHA' AND NEW."constituency_type" <> 'PARLIAMENTARY' THEN
    RAISE EXCEPTION 'Lok Sabha election % cannot map to non-parliamentary constituency type %.',
      NEW."election_id", NEW."constituency_type";
  END IF;

  IF v_election_type = 'STATE_ASSEMBLY' THEN
    IF NEW."constituency_type" <> 'ASSEMBLY' THEN
      RAISE EXCEPTION 'State Assembly election % cannot map to non-assembly constituency type %.',
        NEW."election_id", NEW."constituency_type";
    END IF;

    SELECT "state_id" INTO v_target_state_id
      FROM "assembly_constituencies"
     WHERE "id" = NEW."assembly_constituency_id";

    IF v_target_state_id IS DISTINCT FROM v_election_state_id THEN
      RAISE EXCEPTION 'Assembly constituency % (state %) does not belong to election state %.',
        NEW."assembly_constituency_id", v_target_state_id, v_election_state_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verify_election_constituency_mapping
  BEFORE INSERT OR UPDATE ON "election_constituencies"
  FOR EACH ROW
  EXECUTE FUNCTION verify_election_constituency_mapping();

-- 4. Trigger: Verify CandidateNomination Mapped Constituency & Election Rules
CREATE OR REPLACE FUNCTION verify_candidate_nomination_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_mapped_count INT;
BEGIN
  IF NEW."constituency_type" = 'PARLIAMENTARY' THEN
    SELECT COUNT(*) INTO v_mapped_count
      FROM "election_constituencies"
     WHERE "election_id" = NEW."election_id"
       AND "constituency_type" = 'PARLIAMENTARY'
       AND "parliamentary_constituency_id" = NEW."parliamentary_constituency_id";

    IF v_mapped_count = 0 THEN
      RAISE EXCEPTION 'Parliamentary constituency % is not mapped to election %.',
        NEW."parliamentary_constituency_id", NEW."election_id";
    END IF;
  ELSIF NEW."constituency_type" = 'ASSEMBLY' THEN
    SELECT COUNT(*) INTO v_mapped_count
      FROM "election_constituencies"
     WHERE "election_id" = NEW."election_id"
       AND "constituency_type" = 'ASSEMBLY'
       AND "assembly_constituency_id" = NEW."assembly_constituency_id";

    IF v_mapped_count = 0 THEN
      RAISE EXCEPTION 'Assembly constituency % is not mapped to election %.',
        NEW."assembly_constituency_id", NEW."election_id";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verify_candidate_nomination_integrity
  BEFORE INSERT OR UPDATE ON "candidate_nominations"
  FOR EACH ROW
  EXECUTE FUNCTION verify_candidate_nomination_integrity();
