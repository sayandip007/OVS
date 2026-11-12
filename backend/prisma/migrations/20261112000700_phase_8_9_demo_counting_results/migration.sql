-- ============================================================================
-- OVS Phase 8.9 — Independent Demo Counting & Result Publication Simulation
-- Applies PostgreSQL PL/pgSQL Triggers and Integrity Constraints for:
-- - Counting Sessions & Round Progression
-- - Candidate Tallies & Transactional Vote Sum Reconciliation
-- - Leader, Margin & Tie Detection with Genuine Tie Enforcement
-- - Result Lifecycle State Machine & Publication Gates
-- Aligned with docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql
-- ============================================================================

-- 1. Verify Winner, Runner-Up, and Round Leader Nominations in Counting Sessions
CREATE OR REPLACE FUNCTION verify_counting_session_candidates()
RETURNS TRIGGER AS $$
DECLARE
  v_nom_id UUID;
BEGIN
  -- Prevent winner and runner-up from being the same candidate
  IF NEW.winner_candidate_id IS NOT NULL AND NEW.runner_up_candidate_id IS NOT NULL THEN
    IF NEW.winner_candidate_id = NEW.runner_up_candidate_id THEN
      RAISE EXCEPTION 'Winner candidate (%) and runner-up candidate cannot be identical.', NEW.winner_candidate_id;
    END IF;
  END IF;

  -- Winner must have APPROVED nomination
  IF NEW.winner_candidate_id IS NOT NULL THEN
    IF NEW.constituency_type = 'PARLIAMENTARY' THEN
      SELECT id INTO v_nom_id FROM candidate_nominations
      WHERE candidate_id = NEW.winner_candidate_id AND election_id = NEW.election_id
        AND parliamentary_constituency_id = NEW.parliamentary_constituency_id AND status = 'APPROVED';
    ELSE
      SELECT id INTO v_nom_id FROM candidate_nominations
      WHERE candidate_id = NEW.winner_candidate_id AND election_id = NEW.election_id
        AND assembly_constituency_id = NEW.assembly_constituency_id AND status = 'APPROVED';
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Declared winner % lacks an APPROVED nomination in session constituency.', NEW.winner_candidate_id;
    END IF;
  END IF;

  -- Runner-up must have APPROVED nomination
  IF NEW.runner_up_candidate_id IS NOT NULL THEN
    IF NEW.constituency_type = 'PARLIAMENTARY' THEN
      SELECT id INTO v_nom_id FROM candidate_nominations
      WHERE candidate_id = NEW.runner_up_candidate_id AND election_id = NEW.election_id
        AND parliamentary_constituency_id = NEW.parliamentary_constituency_id AND status = 'APPROVED';
    ELSE
      SELECT id INTO v_nom_id FROM candidate_nominations
      WHERE candidate_id = NEW.runner_up_candidate_id AND election_id = NEW.election_id
        AND assembly_constituency_id = NEW.assembly_constituency_id AND status = 'APPROVED';
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Declared runner-up % lacks an APPROVED nomination in session constituency.', NEW.runner_up_candidate_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_counting_session_candidates ON counting_sessions;
CREATE TRIGGER trg_verify_counting_session_candidates
  BEFORE INSERT OR UPDATE ON counting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION verify_counting_session_candidates();

-- 2. Result Publication State Machine & Tie Resolution Hardening
CREATE OR REPLACE FUNCTION verify_counting_session_publication()
RETURNS TRIGGER AS $$
DECLARE
  v_correction_count INT;
  v_actual_rounds INT;
  v_resolved_winner_id VARCHAR(50);
BEGIN
  -- INSERT Path Protection: Sessions MUST be created in DRAFT
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_published = TRUE OR NEW.status != 'DRAFT' THEN
      RAISE EXCEPTION 'New counting sessions cannot be directly inserted as PUBLISHED. Must begin in DRAFT status with is_published = FALSE (received status: %, is_published: %).',
        NEW.status, NEW.is_published;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE Path: State Transition Graph Validation
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    CASE OLD.status
      WHEN 'DRAFT' THEN
        IF NEW.status NOT IN ('COUNTING_IN_PROGRESS', 'UNPUBLISHED') THEN
          RAISE EXCEPTION 'Illegal state transition from DRAFT to %.', NEW.status;
        END IF;

      WHEN 'COUNTING_IN_PROGRESS' THEN
        IF NEW.status NOT IN ('COUNTING_PAUSED', 'COUNTING_COMPLETED', 'TIED', 'UNPUBLISHED') THEN
          RAISE EXCEPTION 'Illegal state transition from COUNTING_IN_PROGRESS to %.', NEW.status;
        END IF;

      WHEN 'COUNTING_PAUSED' THEN
        IF NEW.status NOT IN ('COUNTING_IN_PROGRESS', 'UNPUBLISHED') THEN
          RAISE EXCEPTION 'Illegal state transition from COUNTING_PAUSED to %.', NEW.status;
        END IF;

      WHEN 'COUNTING_COMPLETED' THEN
        IF NEW.status NOT IN ('RESULT_READY_FOR_REVIEW', 'TIED', 'UNDER_REVIEW') THEN
          RAISE EXCEPTION 'Illegal state transition from COUNTING_COMPLETED to %. Must proceed to RESULT_READY_FOR_REVIEW.', NEW.status;
        END IF;

      WHEN 'TIED' THEN
        IF NEW.status NOT IN ('UNDER_REVIEW', 'RESULT_READY_FOR_REVIEW') THEN
          RAISE EXCEPTION 'Tied result cannot transition to % without formal tie-break review.', NEW.status;
        END IF;

        IF NEW.status = 'RESULT_READY_FOR_REVIEW' THEN
          -- Enforce verified database evidence via dedicated TieResolution model
          IF NEW.winner_candidate_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM tie_resolutions 
            WHERE session_id = NEW.id AND selected_winner_id = NEW.winner_candidate_id
          ) THEN
            RAISE EXCEPTION 'Transition from TIED to RESULT_READY_FOR_REVIEW requires verified database evidence in tie_resolutions matching declared winner %.',
              COALESCE(NEW.winner_candidate_id, 'NULL');
          END IF;
        END IF;

      WHEN 'RESULT_READY_FOR_REVIEW' THEN
        IF NEW.status NOT IN ('PUBLISHED', 'UNDER_REVIEW', 'COUNTING_IN_PROGRESS') THEN
          RAISE EXCEPTION 'Illegal state transition from RESULT_READY_FOR_REVIEW to %.', NEW.status;
        END IF;

      WHEN 'PUBLISHED' THEN
        IF NEW.status NOT IN ('UNDER_REVIEW', 'UNPUBLISHED') THEN
          RAISE EXCEPTION 'Published result cannot transition directly to %. Must be placed UNDER_REVIEW or UNPUBLISHED.', NEW.status;
        END IF;

      WHEN 'UNDER_REVIEW' THEN
        IF NEW.status NOT IN ('CORRECTED', 'RESULT_READY_FOR_REVIEW', 'UNPUBLISHED') THEN
          RAISE EXCEPTION 'Illegal state transition from UNDER_REVIEW to %.', NEW.status;
        END IF;

      WHEN 'CORRECTED' THEN
        IF NEW.status NOT IN ('RESULT_READY_FOR_REVIEW', 'UNDER_REVIEW') THEN
          RAISE EXCEPTION 'Corrected result must return to RESULT_READY_FOR_REVIEW before publication (attempted transition to %).', NEW.status;
        END IF;

      WHEN 'UNPUBLISHED' THEN
        IF NEW.status NOT IN ('UNDER_REVIEW', 'DRAFT') THEN
          RAISE EXCEPTION 'Illegal state transition from UNPUBLISHED to %.', NEW.status;
        END IF;

      ELSE
        RAISE EXCEPTION 'Unknown previous status %.', OLD.status;
    END CASE;
  END IF;

  -- Enforce TieResolution winner consistency across review and publication stages
  IF NEW.status IN ('RESULT_READY_FOR_REVIEW', 'PUBLISHED') THEN
    SELECT selected_winner_id INTO v_resolved_winner_id
    FROM tie_resolutions
    WHERE session_id = NEW.id;

    IF FOUND THEN
      IF NEW.winner_candidate_id IS DISTINCT FROM v_resolved_winner_id THEN
        RAISE EXCEPTION 'Declared session winner (%) does not match resolved winner (%) in tie_resolutions for session %.',
          COALESCE(NEW.winner_candidate_id, 'NULL'), v_resolved_winner_id, NEW.id;
      END IF;
    END IF;
  END IF;

  -- Publication Invariant Enforcement (is_published = TRUE or status = PUBLISHED)
  IF NEW.is_published = TRUE OR NEW.status = 'PUBLISHED' THEN
    IF OLD.status != 'RESULT_READY_FOR_REVIEW' THEN
      RAISE EXCEPTION 'Cannot publish result from status %; must be reviewed in RESULT_READY_FOR_REVIEW stage first.', OLD.status;
    END IF;

    NEW.status := 'PUBLISHED';
    NEW.is_published := TRUE;

    IF NEW.current_round < NEW.total_configured_rounds THEN
      RAISE EXCEPTION 'Cannot publish result: counting is incomplete (% of % rounds completed).',
        NEW.current_round, NEW.total_configured_rounds;
    END IF;

    SELECT COUNT(*) INTO v_actual_rounds 
    FROM counting_rounds 
    WHERE session_id = NEW.id;

    IF v_actual_rounds < NEW.total_configured_rounds THEN
      RAISE EXCEPTION 'Cannot publish result: only % of % configured counting round records exist.',
        v_actual_rounds, NEW.total_configured_rounds;
    END IF;

    IF NEW.status = 'TIED' OR OLD.status = 'TIED' THEN
      IF NOT EXISTS (SELECT 1 FROM tie_resolutions WHERE session_id = NEW.id) THEN
        RAISE EXCEPTION 'Cannot publish result while in TIED status without documented resolution.';
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM tie_resolutions WHERE session_id = NEW.id) THEN
      IF NEW.winner_candidate_id IS DISTINCT FROM (SELECT selected_winner_id FROM tie_resolutions WHERE session_id = NEW.id) THEN
        RAISE EXCEPTION 'Published winner (%) does not match resolved winner (%) in tie_resolutions.',
          COALESCE(NEW.winner_candidate_id, 'NULL'), (SELECT selected_winner_id FROM tie_resolutions WHERE session_id = NEW.id);
      END IF;
    END IF;

    IF NEW.published_by_admin_id IS NULL THEN
      RAISE EXCEPTION 'Publication rejected: published_by_admin_id must be populated.';
    END IF;

    IF NEW.published_at IS NULL THEN
      NEW.published_at := NOW();
    END IF;

    IF NEW.winner_candidate_id IS NULL AND NEW.total_counted_votes > 0 THEN
      RAISE EXCEPTION 'Cannot publish result without a declared winner.';
    END IF;
  ELSE
    NEW.is_published := FALSE;
  END IF;

  -- Correction Audit Trail Invariant
  IF OLD.status = 'UNDER_REVIEW' AND NEW.status = 'CORRECTED' THEN
    SELECT COUNT(*) INTO v_correction_count
    FROM result_correction_history
    WHERE session_id = NEW.id;

    IF v_correction_count = 0 THEN
      RAISE EXCEPTION 'Cannot transition to CORRECTED without an immutable result_correction_history entry.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_counting_session_publication ON counting_sessions;
CREATE TRIGGER trg_verify_counting_session_publication
  BEFORE INSERT OR UPDATE ON counting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION verify_counting_session_publication();

-- 3. Dedicated TieResolution INSERT Validation Trigger
CREATE OR REPLACE FUNCTION verify_tie_resolution_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_session_status "ResultStatus";
  v_election_id VARCHAR(50);
  v_constituency_type "ConstituencyType";
  v_pc_id VARCHAR(50);
  v_ac_id VARCHAR(50);
  v_session_winner_id VARCHAR(50);
  v_target_state_id VARCHAR(10);
  v_winner_nom_id UUID;
  v_admin_role "AdminRole";
  v_admin_state_id VARCHAR(10);
  v_admin_active BOOLEAN;
  v_user_active BOOLEAN;
  v_total_tally_count INT;
  v_max_votes INT;
  v_top_tied_count INT;
  v_winner_votes INT;
BEGIN
  SELECT status, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, winner_candidate_id
  INTO v_session_status, v_election_id, v_constituency_type, v_pc_id, v_ac_id, v_session_winner_id
  FROM counting_sessions
  WHERE id = NEW.session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TieResolution validation failed: referenced counting session % does not exist.', NEW.session_id;
  END IF;

  IF v_session_status != 'TIED' THEN
    RAISE EXCEPTION 'TieResolution validation failed: session % must be in TIED status (current status: %).',
      NEW.session_id, v_session_status;
  END IF;

  IF EXISTS (SELECT 1 FROM tie_resolutions WHERE session_id = NEW.session_id) THEN
    RAISE EXCEPTION 'TieResolution validation failed: session % already has an immutable tie resolution record.',
      NEW.session_id;
  END IF;

  IF v_constituency_type = 'PARLIAMENTARY' THEN
    SELECT state_id INTO v_target_state_id
    FROM parliamentary_constituencies
    WHERE id = v_pc_id;

    SELECT id INTO v_winner_nom_id
    FROM candidate_nominations
    WHERE candidate_id = NEW.selected_winner_id
      AND election_id = v_election_id
      AND constituency_type = 'PARLIAMENTARY'
      AND parliamentary_constituency_id = v_pc_id
      AND status = 'APPROVED'
    FOR SHARE;
  ELSE
    SELECT state_id INTO v_target_state_id
    FROM assembly_constituencies
    WHERE id = v_ac_id;

    SELECT id INTO v_winner_nom_id
    FROM candidate_nominations
    WHERE candidate_id = NEW.selected_winner_id
      AND election_id = v_election_id
      AND constituency_type = 'ASSEMBLY'
      AND assembly_constituency_id = v_ac_id
      AND status = 'APPROVED'
    FOR SHARE;
  END IF;

  IF NOT FOUND OR v_winner_nom_id IS NULL THEN
    RAISE EXCEPTION 'TieResolution validation failed: selected winner % does not hold an APPROVED nomination in election % for constituency %.',
      NEW.selected_winner_id, v_election_id, COALESCE(v_pc_id, v_ac_id);
  END IF;

  SELECT COUNT(*) INTO v_total_tally_count
  FROM candidate_tallies
  WHERE session_id = NEW.session_id;

  IF v_total_tally_count = 0 THEN
    RAISE EXCEPTION 'TieResolution validation failed: no candidate tallies exist for session %.',
      NEW.session_id;
  END IF;

  IF v_constituency_type = 'PARLIAMENTARY' THEN
    SELECT MAX(ct.votes) INTO v_max_votes
    FROM candidate_tallies ct
    JOIN candidate_nominations cn
      ON cn.id = ct.nomination_id
     AND cn.candidate_id = ct.candidate_id
    WHERE ct.session_id = NEW.session_id
      AND cn.election_id = v_election_id
      AND cn.constituency_type = 'PARLIAMENTARY'
      AND cn.parliamentary_constituency_id = v_pc_id
      AND cn.status = 'APPROVED';

    SELECT COUNT(*) INTO v_top_tied_count
    FROM candidate_tallies ct
    JOIN candidate_nominations cn
      ON cn.id = ct.nomination_id
     AND cn.candidate_id = ct.candidate_id
    WHERE ct.session_id = NEW.session_id
      AND ct.votes = v_max_votes
      AND cn.election_id = v_election_id
      AND cn.constituency_type = 'PARLIAMENTARY'
      AND cn.parliamentary_constituency_id = v_pc_id
      AND cn.status = 'APPROVED';

    SELECT ct.votes INTO v_winner_votes
    FROM candidate_tallies ct
    JOIN candidate_nominations cn
      ON cn.id = ct.nomination_id
     AND cn.candidate_id = ct.candidate_id
    WHERE ct.session_id = NEW.session_id
      AND ct.candidate_id = NEW.selected_winner_id
      AND cn.election_id = v_election_id
      AND cn.constituency_type = 'PARLIAMENTARY'
      AND cn.parliamentary_constituency_id = v_pc_id
      AND cn.status = 'APPROVED';
  ELSE
    SELECT MAX(ct.votes) INTO v_max_votes
    FROM candidate_tallies ct
    JOIN candidate_nominations cn
      ON cn.id = ct.nomination_id
     AND cn.candidate_id = ct.candidate_id
    WHERE ct.session_id = NEW.session_id
      AND cn.election_id = v_election_id
      AND cn.constituency_type = 'ASSEMBLY'
      AND cn.assembly_constituency_id = v_ac_id
      AND cn.status = 'APPROVED';

    SELECT COUNT(*) INTO v_top_tied_count
    FROM candidate_tallies ct
    JOIN candidate_nominations cn
      ON cn.id = ct.nomination_id
     AND cn.candidate_id = ct.candidate_id
    WHERE ct.session_id = NEW.session_id
      AND ct.votes = v_max_votes
      AND cn.election_id = v_election_id
      AND cn.constituency_type = 'ASSEMBLY'
      AND cn.assembly_constituency_id = v_ac_id
      AND cn.status = 'APPROVED';

    SELECT ct.votes INTO v_winner_votes
    FROM candidate_tallies ct
    JOIN candidate_nominations cn
      ON cn.id = ct.nomination_id
     AND cn.candidate_id = ct.candidate_id
    WHERE ct.session_id = NEW.session_id
      AND ct.candidate_id = NEW.selected_winner_id
      AND cn.election_id = v_election_id
      AND cn.constituency_type = 'ASSEMBLY'
      AND cn.assembly_constituency_id = v_ac_id
      AND cn.status = 'APPROVED';
  END IF;

  IF v_max_votes IS NULL OR v_max_votes <= 0 THEN
    RAISE EXCEPTION 'TieResolution validation failed: maximum vote count among eligible APPROVED candidates in session % must be greater than zero (found: %).',
      NEW.session_id, COALESCE(v_max_votes, 0);
  END IF;

  IF v_winner_votes IS NULL THEN
    RAISE EXCEPTION 'TieResolution validation failed: selected winner % has no eligible candidate tally in session %.',
      NEW.selected_winner_id, NEW.session_id;
  END IF;

  IF v_top_tied_count < 2 THEN
    RAISE EXCEPTION 'TieResolution validation failed: genuine tie requires at least 2 eligible APPROVED candidates tied at highest votes (%) in session % (v_top_tied_count = %).',
      v_max_votes, NEW.session_id, v_top_tied_count;
  END IF;

  IF v_winner_votes != v_max_votes THEN
    RAISE EXCEPTION 'TieResolution validation failed: selected winner % (votes: %) is not tied for the highest vote total (%) in session %.',
      NEW.selected_winner_id, v_winner_votes, v_max_votes, NEW.session_id;
  END IF;

  SELECT a.role, a.assigned_state_id, a.is_active, u.is_active
  INTO v_admin_role, v_admin_state_id, v_admin_active, v_user_active
  FROM admin_users a
  JOIN users u ON u.id = a.user_id
  WHERE a.id = NEW.approved_by_admin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TieResolution validation failed: approving administrator % does not exist.',
      NEW.approved_by_admin_id;
  END IF;

  IF NOT v_admin_active OR NOT v_user_active THEN
    RAISE EXCEPTION 'TieResolution validation failed: approving administrator % is inactive.',
      NEW.approved_by_admin_id;
  END IF;

  IF v_admin_role = 'READ_ONLY_AUDITOR' THEN
    RAISE EXCEPTION 'TieResolution validation failed: READ_ONLY_AUDITOR % is not authorized to approve tie resolutions.',
      NEW.approved_by_admin_id;
  END IF;

  IF v_admin_role = 'STATE_ADMIN' THEN
    IF v_admin_state_id IS NULL OR v_admin_state_id != v_target_state_id THEN
      RAISE EXCEPTION 'TieResolution validation failed: STATE_ADMIN % assigned state (%) does not match constituency state (%).',
        NEW.approved_by_admin_id, COALESCE(v_admin_state_id, 'NULL'), v_target_state_id;
    END IF;
  ELSIF v_admin_role = 'ELECTION_OFFICER' THEN
    IF v_admin_state_id IS NOT NULL AND v_admin_state_id != v_target_state_id THEN
      RAISE EXCEPTION 'TieResolution validation failed: ELECTION_OFFICER % assigned state (%) does not match constituency state (%).',
        NEW.approved_by_admin_id, v_admin_state_id, v_target_state_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM admin_election_scopes
      WHERE admin_user_id = NEW.approved_by_admin_id AND election_id = v_election_id
    ) THEN
      RAISE EXCEPTION 'TieResolution validation failed: ELECTION_OFFICER % is not scoped to election % in admin_election_scopes.',
        NEW.approved_by_admin_id, v_election_id;
    END IF;
  ELSIF v_admin_role IN ('SUPER_ADMIN', 'NATIONAL_ADMIN') THEN
    IF v_admin_state_id IS NOT NULL AND v_admin_state_id != v_target_state_id THEN
      RAISE EXCEPTION 'TieResolution validation failed: administrator % state scope (%) does not match constituency state (%).',
        NEW.approved_by_admin_id, v_admin_state_id, v_target_state_id;
    END IF;
  END IF;

  IF NEW.decision IS NULL OR NEW.decision NOT IN ('WINNER_SELECTED_BY_LOT', 'SIMULATED_DRAW_WINNER_DECLARED', 'RECOUNT_TIE_BROKEN_BY_LOT', 'SIMULATED_TIE_BROKEN_DRAW_OF_LOTS') THEN
    RAISE EXCEPTION 'TieResolution validation failed: invalid decision value (%).', COALESCE(NEW.decision, 'NULL');
  END IF;

  IF NEW.resolution_method IS NULL OR NEW.resolution_method NOT IN ('SIMULATED_DRAW_OF_LOTS', 'DRAW_OF_LOTS', 'SIMULATED_RO_LOTTERY', 'DRAW_OF_LOTS_RO_SECTION_102_RPA_1951') THEN
    RAISE EXCEPTION 'TieResolution validation failed: invalid resolution_method value (%).', COALESCE(NEW.resolution_method, 'NULL');
  END IF;

  IF NEW.justification_note IS NULL OR LENGTH(BTRIM(NEW.justification_note)) < 10 THEN
    RAISE EXCEPTION 'TieResolution validation failed: justification_note must be non-empty (minimum 10 characters).';
  END IF;

  IF v_session_winner_id IS NOT NULL AND v_session_winner_id != NEW.selected_winner_id THEN
    RAISE EXCEPTION 'TieResolution validation failed: selected_winner_id (%) conflicts with session winner_candidate_id (%).',
      NEW.selected_winner_id, v_session_winner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_tie_resolution_insert ON tie_resolutions;
CREATE TRIGGER trg_verify_tie_resolution_insert
  BEFORE INSERT ON tie_resolutions
  FOR EACH ROW
  EXECUTE FUNCTION verify_tie_resolution_insert();

-- 4. Protect Tie Resolution Immutability & Prevent CountingSession Deletion with Tie Evidence
CREATE OR REPLACE FUNCTION protect_tie_resolution_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Tie resolution records are immutable audit evidence in the OVS simulation and cannot be modified or deleted once approved (attempted % on tie_resolutions id %).',
    TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_tie_resolution_immutability ON tie_resolutions;
CREATE TRIGGER trg_protect_tie_resolution_immutability
  BEFORE UPDATE OR DELETE ON tie_resolutions
  FOR EACH ROW
  EXECUTE FUNCTION protect_tie_resolution_immutability();

CREATE OR REPLACE FUNCTION protect_counting_session_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM tie_resolutions WHERE session_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete counting session %: immutable tie_resolutions evidence exists (onDelete: Restrict policy). Use an archival state instead.',
      OLD.id;
  END IF;

  IF OLD.status = 'PUBLISHED' OR OLD.is_published = TRUE THEN
    RAISE EXCEPTION 'Cannot delete published counting session %. Transition to UNPUBLISHED or archival state first.',
      OLD.id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_counting_session_deletion ON counting_sessions;
CREATE TRIGGER trg_protect_counting_session_deletion
  BEFORE DELETE ON counting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION protect_counting_session_deletion();

-- 5. Reconcile Counting Session Vote Sums on CountingSession Updates
CREATE OR REPLACE FUNCTION reconcile_counting_session_votes()
RETURNS TRIGGER AS $$
DECLARE
  v_candidate_votes_sum INT;
  v_calculated_total INT;
BEGIN
  IF NEW.current_round > 0 OR NEW.status IN ('COUNTING_COMPLETED', 'RESULT_READY_FOR_REVIEW', 'PUBLISHED') THEN
    SELECT COALESCE(SUM(votes), 0) INTO v_candidate_votes_sum
    FROM candidate_tallies
    WHERE session_id = NEW.id;

    v_calculated_total := v_candidate_votes_sum + NEW.nota_votes + NEW.rejected_votes;

    IF NEW.total_counted_votes != v_calculated_total THEN
      RAISE EXCEPTION 'Vote reconciliation error in session %: total_counted_votes (%) != sum of candidate votes (%) + NOTA (%) + rejected (%).',
        NEW.id, NEW.total_counted_votes, v_candidate_votes_sum, NEW.nota_votes, NEW.rejected_votes;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reconcile_counting_session_votes ON counting_sessions;
CREATE TRIGGER trg_reconcile_counting_session_votes
  BEFORE UPDATE ON counting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_counting_session_votes();

-- 6. Protect & Reconcile Candidate Tallies Against Session Transfer & Completed Sessions
CREATE OR REPLACE FUNCTION protect_and_reconcile_candidate_tallies()
RETURNS TRIGGER AS $$
DECLARE
  v_target_session_id VARCHAR(100);
  v_session_status "ResultStatus";
  v_total_counted INT;
  v_nota INT;
  v_rejected INT;
  v_current_round INT;
  v_configured_rounds INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.session_id != NEW.session_id THEN
      RAISE EXCEPTION 'CandidateTally session_id is immutable after INSERT (attempted transfer of tally % from session % to %).',
        OLD.id, OLD.session_id, NEW.session_id;
    END IF;

    IF OLD.candidate_id != NEW.candidate_id THEN
      RAISE EXCEPTION 'CandidateTally candidate_id is immutable after INSERT (attempted change on tally % from % to %).',
        OLD.id, OLD.candidate_id, NEW.candidate_id;
    END IF;
  END IF;

  v_target_session_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;

  SELECT status, total_counted_votes, nota_votes, rejected_votes, current_round, total_configured_rounds
  INTO v_session_status, v_total_counted, v_nota, v_rejected, v_current_round, v_configured_rounds
  FROM counting_sessions 
  WHERE id = v_target_session_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced counting session % not found.', v_target_session_id;
  END IF;

  IF v_session_status IN ('COUNTING_COMPLETED', 'RESULT_READY_FOR_REVIEW', 'PUBLISHED', 'TIED') THEN
    RAISE EXCEPTION 'Cannot % candidate tallies: session % is in % status. Modifications require an explicit UNDER_REVIEW or recount state.',
      TG_OP, v_target_session_id, v_session_status;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_and_reconcile_candidate_tallies ON candidate_tallies;
CREATE TRIGGER trg_protect_and_reconcile_candidate_tallies
  BEFORE INSERT OR UPDATE OR DELETE ON candidate_tallies
  FOR EACH ROW
  EXECUTE FUNCTION protect_and_reconcile_candidate_tallies();

-- 7. Active Counting Automatic Tally Reconciliation
CREATE OR REPLACE FUNCTION auto_reconcile_session_votes_on_tally_change()
RETURNS TRIGGER AS $$
DECLARE
  v_target_session_id VARCHAR(100);
  v_candidate_sum INT;
  v_session_status "ResultStatus";
BEGIN
  v_target_session_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;

  SELECT status INTO v_session_status
  FROM counting_sessions
  WHERE id = v_target_session_id
  FOR UPDATE;

  IF v_session_status IN ('DRAFT', 'COUNTING_IN_PROGRESS', 'COUNTING_PAUSED', 'UNDER_REVIEW', 'CORRECTED') THEN
    SELECT COALESCE(SUM(votes), 0) INTO v_candidate_sum
    FROM candidate_tallies
    WHERE session_id = v_target_session_id;

    UPDATE counting_sessions
    SET total_counted_votes = v_candidate_sum + nota_votes + rejected_votes
    WHERE id = v_target_session_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_reconcile_session_votes_on_tally_change ON candidate_tallies;
CREATE TRIGGER trg_auto_reconcile_session_votes_on_tally_change
  AFTER INSERT OR UPDATE OR DELETE ON candidate_tallies
  FOR EACH ROW
  EXECUTE FUNCTION auto_reconcile_session_votes_on_tally_change();

-- 8. Verify Sequential Counting Rounds Progression & Round Leader Integrity
CREATE OR REPLACE FUNCTION verify_counting_round_progression()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_cumulative INT;
  v_configured_rounds INT;
  v_session_status "ResultStatus";
  v_election_id VARCHAR(50);
  v_constituency_type "ConstituencyType";
  v_pc_id VARCHAR(50);
  v_ac_id VARCHAR(50);
  v_leader_nom_id UUID;
  v_max_round INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.session_id != NEW.session_id THEN
      RAISE EXCEPTION 'Cannot transfer counting round % to different session (attempted: % -> %).',
        OLD.id, OLD.session_id, NEW.session_id;
    END IF;

    IF OLD.round_number != NEW.round_number THEN
      RAISE EXCEPTION 'Cannot modify round_number (% to %) on existing round record. Rounds must be deleted in reverse order and re-inserted.',
        OLD.round_number, NEW.round_number;
    END IF;
  END IF;

  SELECT total_configured_rounds, status, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id
  INTO v_configured_rounds, v_session_status, v_election_id, v_constituency_type, v_pc_id, v_ac_id
  FROM counting_sessions 
  WHERE id = NEW.session_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced counting session % not found.', NEW.session_id;
  END IF;

  IF v_session_status IN ('COUNTING_COMPLETED', 'RESULT_READY_FOR_REVIEW', 'PUBLISHED', 'TIED') THEN
    RAISE EXCEPTION 'Cannot add or modify rounds: counting session % is in % status.', NEW.session_id, v_session_status;
  END IF;

  IF NEW.round_number < 1 OR NEW.round_number > v_configured_rounds THEN
    RAISE EXCEPTION 'Round number % must be between 1 and configured rounds %.', 
      NEW.round_number, v_configured_rounds;
  END IF;

  IF NEW.leading_candidate_id IS NOT NULL THEN
    IF v_constituency_type = 'PARLIAMENTARY' THEN
      SELECT id INTO v_leader_nom_id 
      FROM candidate_nominations
      WHERE candidate_id = NEW.leading_candidate_id 
        AND election_id = v_election_id
        AND parliamentary_constituency_id = v_pc_id 
        AND status = 'APPROVED'
      FOR SHARE;
    ELSE
      SELECT id INTO v_leader_nom_id 
      FROM candidate_nominations
      WHERE candidate_id = NEW.leading_candidate_id 
        AND election_id = v_election_id
        AND assembly_constituency_id = v_ac_id 
        AND status = 'APPROVED'
      FOR SHARE;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Round % leader % lacks an APPROVED nomination in session constituency.',
        NEW.round_number, NEW.leading_candidate_id;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(MAX(round_number), 0) INTO v_max_round
    FROM counting_rounds 
    WHERE session_id = NEW.session_id;

    IF NEW.round_number != v_max_round + 1 THEN
      RAISE EXCEPTION 'Round number % is not sequential; expected %.', NEW.round_number, (v_max_round + 1);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM counting_rounds WHERE session_id = NEW.session_id AND round_number > NEW.round_number) THEN
      IF OLD.cumulative_votes != NEW.cumulative_votes OR OLD.round_votes != NEW.round_votes THEN
        RAISE EXCEPTION 'Cannot modify vote totals for earlier round % when subsequent rounds exist. Modifications require rolling back subsequent rounds first.',
          NEW.round_number;
      END IF;
    END IF;
  END IF;

  IF NEW.round_number > 1 THEN
    SELECT cumulative_votes INTO v_prev_cumulative
    FROM counting_rounds
    WHERE session_id = NEW.session_id AND round_number = NEW.round_number - 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot record round % before round % exists.',
        NEW.round_number, NEW.round_number - 1;
    END IF;

    IF NEW.cumulative_votes < v_prev_cumulative THEN
      RAISE EXCEPTION 'Cumulative votes decreasing in round % (current: %, previous: %).',
        NEW.round_number, NEW.cumulative_votes, v_prev_cumulative;
    END IF;

    IF NEW.round_votes != (NEW.cumulative_votes - v_prev_cumulative) THEN
      RAISE EXCEPTION 'Round % votes (%) does not match delta between cumulative totals (%).',
        NEW.round_number, NEW.round_votes, (NEW.cumulative_votes - v_prev_cumulative);
    END IF;
  ELSE
    IF NEW.round_votes != NEW.cumulative_votes THEN
      RAISE EXCEPTION 'In round 1, round_votes (%) must equal cumulative_votes (%).',
        NEW.round_votes, NEW.cumulative_votes;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_counting_round_progression ON counting_rounds;
CREATE TRIGGER trg_verify_counting_round_progression
  BEFORE INSERT OR UPDATE ON counting_rounds
  FOR EACH ROW
  EXECUTE FUNCTION verify_counting_round_progression();

-- 9. Protect Counting Round Deletion (Reverse-Order Rollback Only)
CREATE OR REPLACE FUNCTION protect_counting_round_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_session_status "ResultStatus";
  v_max_round INT;
BEGIN
  SELECT status INTO v_session_status 
  FROM counting_sessions 
  WHERE id = OLD.session_id 
  FOR UPDATE;

  IF v_session_status IN ('COUNTING_COMPLETED', 'RESULT_READY_FOR_REVIEW', 'PUBLISHED', 'TIED') THEN
    RAISE EXCEPTION 'Cannot delete round %: counting session % is in % status.',
      OLD.round_number, OLD.session_id, v_session_status;
  END IF;

  SELECT MAX(round_number) INTO v_max_round 
  FROM counting_rounds 
  WHERE session_id = OLD.session_id;

  IF OLD.round_number < v_max_round THEN
    RAISE EXCEPTION 'Cannot delete round %: subsequent rounds exist up to %. Rounds must be deleted in strict reverse order.',
      OLD.round_number, v_max_round;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_counting_round_deletion ON counting_rounds;
CREATE TRIGGER trg_protect_counting_round_deletion
  BEFORE DELETE ON counting_rounds
  FOR EACH ROW
  EXECUTE FUNCTION protect_counting_round_deletion();

-- 10. Synchronize Current Round Counter on Round Insert, Update, or Delete
CREATE OR REPLACE FUNCTION synchronize_session_current_round()
RETURNS TRIGGER AS $$
DECLARE
  v_target_session_id VARCHAR(100);
  v_max_round INT;
BEGIN
  v_target_session_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;

  SELECT COALESCE(MAX(round_number), 0) INTO v_max_round
  FROM counting_rounds 
  WHERE session_id = v_target_session_id;

  UPDATE counting_sessions 
  SET current_round = v_max_round
  WHERE id = v_target_session_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_synchronize_session_current_round ON counting_rounds;
CREATE TRIGGER trg_synchronize_session_current_round
  AFTER INSERT OR UPDATE OR DELETE ON counting_rounds
  FOR EACH ROW
  EXECUTE FUNCTION synchronize_session_current_round();
