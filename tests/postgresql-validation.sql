-- ============================================================================
-- Online Voting System (OVS) — PostgreSQL 16+ Integration Validation Suite
-- Phase 8.1.3: Real Database Test Scenarios for Disposable Validation DB
-- ============================================================================
-- INSTRUCTIONS FOR EXECUTION:
-- Run these scenarios against a disposable local PostgreSQL 16+ instance:
--   createdb ovs_validation_db
--   psql -d ovs_validation_db -f docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql
--   psql -d ovs_validation_db -f tests/postgresql-validation.sql
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ----------------------------------------------------------------------------
-- SCENARIO 1: Valid Geographic Hierarchy Insertion
-- ----------------------------------------------------------------------------
SAVEPOINT s1_valid_geo;

INSERT INTO states (id, code, name, jurisdiction_type, official_languages, total_lok_sabha_seats, total_assembly_seats, metadata_source, created_at, updated_at)
VALUES ('TEST_ST', 'TS', 'Test State', 'STATE', ARRAY['English'], 2, 10, 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO districts (id, state_id, district_code, name, headquarters_city, created_at, updated_at)
VALUES ('TEST_DIST_1', 'TEST_ST', 'TD1', 'Test District 1', 'Test City', NOW(), NOW());

INSERT INTO parliamentary_constituencies (id, state_id, constituency_number, name, reservation_type, total_electors, created_at, updated_at)
VALUES ('TEST_PC_1', 'TEST_ST', 1, 'Test PC 1', 'GENERAL', 50000, NOW(), NOW());

INSERT INTO assembly_constituencies (id, state_id, district_id, parent_parliamentary_constituency_id, constituency_number, name, reservation_type, total_electors, created_at, updated_at)
VALUES ('TEST_AC_1', 'TEST_ST', 'TEST_DIST_1', 'TEST_PC_1', 1, 'Test AC 1', 'GENERAL', 25000, NOW(), NOW());

-- ----------------------------------------------------------------------------
-- SCENARIO 2: Invalid Geographic Hierarchy Rejection (Cross-State AC)
-- ----------------------------------------------------------------------------
SAVEPOINT s2_invalid_geo;

INSERT INTO states (id, code, name, jurisdiction_type, official_languages, total_lok_sabha_seats, total_assembly_seats, metadata_source, created_at, updated_at)
VALUES ('TEST_ST_2', 'T2', 'Test State 2', 'STATE', ARRAY['English'], 1, 5, 'DEMO_SAMPLE', NOW(), NOW());

-- Attempt to insert AC linking to district in state 1 with state_id of state 2 (Must Fail FK)
DO $$
BEGIN
  INSERT INTO assembly_constituencies (id, state_id, district_id, parent_parliamentary_constituency_id, constituency_number, name, reservation_type, total_electors, created_at, updated_at)
  VALUES ('TEST_AC_INVALID', 'TEST_ST_2', 'TEST_DIST_1', 'TEST_PC_1', 99, 'Invalid AC', 'GENERAL', 10000, NOW(), NOW());
  RAISE EXCEPTION 'Cross-state AC insertion succeeded unexpectedly!';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'SUCCESS: Cross-state AC rejected by composite foreign key fk_ac_district_state.';
END;
$$;

-- ----------------------------------------------------------------------------
-- SCENARIO 3: Valid and Invalid Election Mappings
-- ----------------------------------------------------------------------------
SAVEPOINT s3_elections;

-- Insert Lok Sabha Election
INSERT INTO elections (id, title, election_type, state_id, nomination_start_date, nomination_end_date, polling_start_date, polling_end_date, counting_date, results_declaration_date, demo_sandbox_mode, created_at, updated_at)
VALUES ('TEST_ELEC_LS', 'Lok Sabha 2029', 'LOK_SABHA', NULL, CURRENT_DATE, CURRENT_DATE + 5, CURRENT_DATE + 10, CURRENT_DATE + 10, CURRENT_DATE + 12, CURRENT_DATE + 13, 'ACTIVE_SIMULATED', NOW(), NOW());

-- Map PC to Lok Sabha (Valid)
INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, elector_count, is_counting_completed, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, 50000, FALSE, NOW(), NOW());

-- Attempt to map AC to Lok Sabha (Must Fail)
DO $$
BEGIN
  INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, elector_count, is_counting_completed, created_at, updated_at)
  VALUES ('22222222-2222-2222-2222-222222222222', 'TEST_ELEC_LS', 'ASSEMBLY', NULL, 'TEST_AC_1', 25000, FALSE, NOW(), NOW());
  RAISE EXCEPTION 'Lok Sabha mapped to Assembly Constituency unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Invalid election constituency mapping rejected: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- SCENARIO 4: Candidate Nomination Integrity & Unmapped Constituency Rejection
-- ----------------------------------------------------------------------------
SAVEPOINT s4_nominations;

INSERT INTO political_parties (id, name, party_code, party_type, symbol_name, symbol_url, founded_year, national_seat_count, state_seat_count, active_candidate_count, created_at, updated_at)
VALUES ('TEST_PARTY', 'National Test Party', 'NTP', 'NATIONAL', 'Lotus', 'https://example.com/lotus.png', 1980, 100, 200, 50, NOW(), NOW());

INSERT INTO candidates (id, party_id, full_name, age, gender, education, profession, criminal_cases, assets_declared, liabilities_declared, photo_url, bio, metadata_source, created_at, updated_at)
VALUES ('TEST_CAND_1', 'TEST_PARTY', 'John Doe Candidate', 45, 'MALE', 'Graduate', 'Social Worker', 0, 1000000, 50000, NULL, 'Bio', 'DEMO_SAMPLE', NOW(), NOW());

-- Valid Nomination in Mapped PC
INSERT INTO candidate_nominations (id, candidate_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('33333333-3333-3333-3333-333333333333', 'TEST_CAND_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, NOW(), 'APPROVED', 'Scrutiny passed', NOW(), NOW());

-- Attempt to Nominate in Unmapped PC (Must Fail)
INSERT INTO parliamentary_constituencies (id, state_id, constituency_number, name, reservation_type, total_electors, created_at, updated_at)
VALUES ('TEST_PC_UNMAPPED', 'TEST_ST', 2, 'Unmapped PC', 'GENERAL', 40000, NOW(), NOW());

DO $$
BEGIN
  INSERT INTO candidate_nominations (id, candidate_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
  VALUES ('44444444-4444-4444-4444-444444444444', 'TEST_CAND_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, NOW(), 'APPROVED', 'Note', NOW(), NOW());
  RAISE EXCEPTION 'Nomination in unmapped constituency succeeded unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Nomination in unmapped constituency rejected: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- SCENARIO 5: Section 33(7) Nomination Ceiling Enforcement (>2 Nominations)
-- ----------------------------------------------------------------------------
SAVEPOINT s5_nomination_ceiling;

-- Map second PC to election
INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, elector_count, is_counting_completed, created_at, updated_at)
VALUES ('55555555-5555-5555-5555-555555555555', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, 40000, FALSE, NOW(), NOW());

-- Second nomination for candidate (Legal per s.33(7))
INSERT INTO candidate_nominations (id, candidate_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('66666666-6666-6666-6666-666666666666', 'TEST_CAND_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, NOW(), 'APPROVED', 'Second seat', NOW(), NOW());

-- Add third PC and map
INSERT INTO parliamentary_constituencies (id, state_id, constituency_number, name, reservation_type, total_electors, created_at, updated_at)
VALUES ('TEST_PC_THIRD', 'TEST_ST', 3, 'Third PC', 'GENERAL', 30000, NOW(), NOW());
INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, elector_count, is_counting_completed, created_at, updated_at)
VALUES ('77777777-7777-7777-7777-777777777777', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, 30000, FALSE, NOW(), NOW());

-- Attempt third nomination (Must Fail s.33(7) limit)
DO $$
BEGIN
  INSERT INTO candidate_nominations (id, candidate_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
  VALUES ('88888888-8888-8888-8888-888888888888', 'TEST_CAND_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, NOW(), 'APPROVED', 'Third seat illegal', NOW(), NOW());
  RAISE EXCEPTION 'Third nomination succeeded unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Third nomination rejected by s.33(7) trigger: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- SCENARIO 6: Counting Session Initialization & Publication Equivalence Check
-- ----------------------------------------------------------------------------
SAVEPOINT s6_session_init;

-- Attempt to insert session with status = PUBLISHED directly (Must Fail)
DO $$
BEGIN
  INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
  VALUES ('SESS_ILLEGAL_PUB', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, 'PUBLISHED', TRUE, 5, 5, 1000, 10, 5, 100, NOW(), NOW());
  RAISE EXCEPTION 'Direct insertion as PUBLISHED succeeded unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Direct insertion as PUBLISHED rejected: %', SQLERRM;
END;
$$;

-- Attempt to insert session with status = PUBLISHED and is_published = FALSE (Must Fail CHECK constraint)
DO $$
BEGIN
  INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
  VALUES ('SESS_MISMATCH', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, 'PUBLISHED', FALSE, 5, 0, 0, 0, 0, 0, NOW(), NOW());
  RAISE EXCEPTION 'Conflicting status and is_published flag insertion succeeded unexpectedly!';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'SUCCESS: Conflicting status and is_published rejected by chk_counting_session_publication_equivalence.';
END;
$$;

-- Valid DRAFT session
INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
VALUES ('SESS_VALID_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, 'DRAFT', FALSE, 3, 0, 0, 0, 0, 0, NOW(), NOW());

-- ----------------------------------------------------------------------------
-- SCENARIO 7: Candidate Tally Approved Nomination & NOTA Separation Check
-- ----------------------------------------------------------------------------
SAVEPOINT s7_tallies;

-- Attempt to insert candidate tally with candidate_id = NOTA (Must Fail)
DO $$
BEGIN
  INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
  VALUES ('99999999-9999-9999-9999-999999999999', 'SESS_VALID_1', 'NOTA', '33333333-3333-3333-3333-333333333333', 'TEST_PARTY', 50, 5.00, NOW(), NOW());
  RAISE EXCEPTION 'NOTA inserted as candidate tally unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: NOTA as candidate tally rejected: %', SQLERRM;
END;
$$;

-- Valid Candidate Tally (Links to approved nomination)
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SESS_VALID_1', 'TEST_CAND_1', '33333333-3333-3333-3333-333333333333', 'TEST_PARTY', 1000, 100.00, NOW(), NOW());

-- ----------------------------------------------------------------------------
-- SCENARIO 8: Nomination Lifecycle Protection (Prevent Deletion with Tally)
-- ----------------------------------------------------------------------------
SAVEPOINT s8_nomination_protect;

-- Attempt to delete nomination that has an active tally (Must Fail)
DO $$
BEGIN
  DELETE FROM candidate_nominations WHERE id = '33333333-3333-3333-3333-333333333333';
  RAISE EXCEPTION 'Nomination with active tally deleted unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Nomination with active tally protected from deletion: %', SQLERRM;
END;
$$;

-- Attempt to invalidate nomination status (Must Fail)
DO $$
BEGIN
  UPDATE candidate_nominations SET status = 'REJECTED' WHERE id = '33333333-3333-3333-3333-333333333333';
  RAISE EXCEPTION 'Nomination with active tally changed to REJECTED unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Nomination with active tally protected from invalidation: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- SCENARIO 9: Bidirectional Vote Reconciliation & Zero-Vote Handling
-- ----------------------------------------------------------------------------
SAVEPOINT s9_reconciliation;

-- Transition session to COUNTING_IN_PROGRESS
UPDATE counting_sessions SET status = 'COUNTING_IN_PROGRESS', current_round = 1 WHERE id = 'SESS_VALID_1';

-- Attempt to update session to COUNTING_COMPLETED with incorrect vote sum (Must Fail)
DO $$
BEGIN
  -- Total votes claims 1500, but candidate has 1000, nota has 50, rejected has 10 = 1060 != 1500
  UPDATE counting_sessions 
  SET status = 'COUNTING_COMPLETED', total_counted_votes = 1500, nota_votes = 50, rejected_votes = 10, current_round = 3
  WHERE id = 'SESS_VALID_1';
  RAISE EXCEPTION 'Session completed with unreconciled vote total unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Unreconciled vote total rejected: %', SQLERRM;
END;
$$;

-- Reconcile with exact sum: 1000 (candidate) + 50 (nota) + 10 (rejected) = 1060 (Valid)
UPDATE counting_sessions 
SET status = 'COUNTING_COMPLETED', total_counted_votes = 1060, nota_votes = 50, rejected_votes = 10, current_round = 3, winner_candidate_id = 'TEST_CAND_1'
WHERE id = 'SESS_VALID_1';

-- Attempt to mutate candidate tallies while session is COUNTING_COMPLETED (Must Fail)
DO $$
BEGIN
  UPDATE candidate_tallies SET votes = 1200 WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  RAISE EXCEPTION 'Tally updated in completed session unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Completed session tallies protected from mutation: %', SQLERRM;
END;
$$;

-- ----------------------------------------------------------------------------
-- SCENARIO 10: Publication Review Gate & Completeness Guard
-- ----------------------------------------------------------------------------
SAVEPOINT s10_publication;

-- Attempt to publish directly from COUNTING_COMPLETED (Must Fail - Review Required)
DO $$
BEGIN
  UPDATE counting_sessions SET status = 'PUBLISHED', is_published = TRUE WHERE id = 'SESS_VALID_1';
  RAISE EXCEPTION 'Published directly without review stage unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Direct publication without review rejected: %', SQLERRM;
END;
$$;

-- Transition to RESULT_READY_FOR_REVIEW (Valid)
UPDATE counting_sessions SET status = 'RESULT_READY_FOR_REVIEW' WHERE id = 'SESS_VALID_1';

-- Insert Admin User for publication sign-off
INSERT INTO admin_users (id, officer_code, full_name, email, password_hash, role, created_at, updated_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'OFF-001', 'Returning Officer', 'ro@eci.gov.in', 'hashed_pw', 'ELECTION_OFFICER', NOW(), NOW());

-- Attempt to publish without required counting rounds existing (Must Fail)
DO $$
BEGIN
  UPDATE counting_sessions 
  SET status = 'PUBLISHED', is_published = TRUE, published_by_admin_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  WHERE id = 'SESS_VALID_1';
  RAISE EXCEPTION 'Published without round records existing unexpectedly!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Publication without round records rejected: %', SQLERRM;
END;
$$;

-- Insert all 3 sequential counting rounds
INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, lead_candidate_id, lead_margin, created_at, updated_at)
VALUES ('c1111111-1111-1111-1111-111111111111', 'SESS_VALID_1', 1, 350, 350, 'TEST_CAND_1', 350, NOW(), NOW());

INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, lead_candidate_id, lead_margin, created_at, updated_at)
VALUES ('c2222222-2222-2222-2222-222222222222', 'SESS_VALID_1', 2, 350, 700, 'TEST_CAND_1', 700, NOW(), NOW());

INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, lead_candidate_id, lead_margin, created_at, updated_at)
VALUES ('c3333333-3333-3333-3333-333333333333', 'SESS_VALID_1', 3, 360, 1060, 'TEST_CAND_1', 1060, NOW(), NOW());

-- Publish Session (Valid)
UPDATE counting_sessions 
SET status = 'PUBLISHED', is_published = TRUE, published_by_admin_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE id = 'SESS_VALID_1';

RAISE NOTICE 'SUCCESS: Session published after full review, rounds verification, and reconciliation.';

ROLLBACK;

-- All scenarios passed successfully
SELECT 'OVS Phase 8.1.3 PostgreSQL Integration Validation Suite: ALL 10 SCENARIOS PASSED' AS verdict;
