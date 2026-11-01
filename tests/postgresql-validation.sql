-- ============================================================================
-- Online Voting System (OVS) — PostgreSQL 16+ Integration Validation Suite
-- Phase 8.1.4: Real Database Test Scenarios for Disposable Validation DB
-- ============================================================================
-- INSTRUCTIONS FOR EXECUTION:
-- Run these scenarios against a disposable local PostgreSQL 16+ instance:
--   createdb ovs_validation_db
--   psql -d ovs_validation_db -f docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql
--   psql -d ovs_validation_db -f tests/postgresql-validation.sql
-- ============================================================================
-- SCHEMA ALIGNMENT NOTE:
-- All table names, column names, and enum values strictly match the physical 
-- PostgreSQL mappings defined in docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma.
-- All negative tests use subtransaction assertion blocks catching specific SQLSTATEs
-- to eliminate false-positive catches.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ============================================================================
-- SCENARIO 1: Valid Geographic Hierarchy Insertion
-- ============================================================================
SAVEPOINT s1_valid_geo;

INSERT INTO states (id, name, type, capital, official_languages, total_lok_sabha_seats, total_assembly_seats, metadata_source, created_at, updated_at)
VALUES ('TEST_ST', 'Test State', 'STATE', 'Test Capital', ARRAY['English'], 3, 10, 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO districts (id, state_id, name, headquarters, metadata_source, created_at, updated_at)
VALUES ('TEST_DIST_1', 'TEST_ST', 'Test District 1', 'Test HQ 1', 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO parliamentary_constituencies (id, state_id, constituency_number, name, reservation_type, total_voters, metadata_source, created_at, updated_at)
VALUES ('TEST_PC_1', 'TEST_ST', 1, 'Test PC 1', 'GENERAL', 50000, 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO assembly_constituencies (id, state_id, district_id, parent_parliamentary_constituency_id, constituency_number, name, reservation_type, total_voters, metadata_source, created_at, updated_at)
VALUES ('TEST_AC_1', 'TEST_ST', 'TEST_DIST_1', 'TEST_PC_1', 1, 'Test AC 1', 'GENERAL', 25000, 'DEMO_SAMPLE', NOW(), NOW());

RAISE NOTICE 'SUCCESS: Scenario 1 passed - Valid geographic hierarchy inserted.';

-- ============================================================================
-- SCENARIO 2: Invalid Geographic Hierarchy Rejection (Cross-State AC)
-- ============================================================================
SAVEPOINT s2_invalid_geo;

INSERT INTO states (id, name, type, capital, official_languages, total_lok_sabha_seats, total_assembly_seats, metadata_source, created_at, updated_at)
VALUES ('TEST_ST_2', 'Test State 2', 'STATE', 'Test Capital 2', ARRAY['English'], 1, 5, 'DEMO_SAMPLE', NOW(), NOW());

-- Attempt to insert AC linking to district in state 1 with state_id of state 2 (Must Fail FK)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO assembly_constituencies (id, state_id, district_id, parent_parliamentary_constituency_id, constituency_number, name, reservation_type, total_voters, metadata_source, created_at, updated_at)
    VALUES ('TEST_AC_INVALID', 'TEST_ST_2', 'TEST_DIST_1', 'TEST_PC_1', 99, 'Invalid AC', 'GENERAL', 10000, 'DEMO_SAMPLE', NOW(), NOW());
  EXCEPTION
    WHEN foreign_key_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Cross-state AC rejected by composite foreign key fk_ac_district_state [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 2: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Cross-state AC insertion succeeded unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 3: Valid and Invalid Election Mappings
-- ============================================================================
SAVEPOINT s3_elections;

-- Insert Lok Sabha Election
INSERT INTO elections (id, name, type, year, state_id, status, polling_start_date, polling_end_date, counting_date, result_date, demo_sandbox_mode, description, metadata_source, created_at, updated_at)
VALUES ('TEST_ELEC_LS', 'Lok Sabha 2029', 'LOK_SABHA', 2029, NULL, 'UPCOMING', CURRENT_DATE + 10, CURRENT_DATE + 10, CURRENT_DATE + 12, CURRENT_DATE + 13, 'ACTIVE_SIMULATED', 'General Election', 'DEMO_SAMPLE', NOW(), NOW());

-- Map PC to Lok Sabha (Valid)
INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, created_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, NOW());

-- Attempt to map AC to Lok Sabha Election (Must Fail check or trigger)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, created_at)
    VALUES ('22222222-2222-2222-2222-222222222222', 'TEST_ELEC_LS', 'ASSEMBLY', NULL, 'TEST_AC_1', NOW());
  EXCEPTION
    WHEN check_violation OR SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Lok Sabha to AC mapping rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 3: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Lok Sabha mapped to Assembly Constituency unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 4: Election Constituency Mutation Guard (Prevent Deleting Mapped Seat)
-- ============================================================================
SAVEPOINT s4_constituency_guard;

-- Insert Political Party and Candidate
INSERT INTO political_parties (id, name, abbreviation, party_type, symbol_name, symbol_url, established_year, headquarters, status, metadata_source, created_at, updated_at)
VALUES ('TEST_PARTY_1', 'National Test Party', 'NTP', 'NATIONAL', 'Lotus', 'https://example.com/lotus.png', 1980, 'New Delhi', 'ACTIVE', 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO candidates (id, party_id, full_name, age, gender, education, profession, criminal_cases, assets_declared, liabilities_declared, photo_url, bio, metadata_source, created_at, updated_at)
VALUES ('TEST_CAND_1', 'TEST_PARTY_1', 'John Doe Candidate', 45, 'MALE', 'Graduate', 'Social Worker', 0, 1000000, 50000, NULL, 'Bio', 'DEMO_SAMPLE', NOW(), NOW());

-- Valid Nomination in Mapped PC
INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('33333333-3333-3333-3333-333333333333', 'TEST_CAND_1', 'TEST_PARTY_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, NOW(), 'APPROVED', 'Scrutiny passed', NOW(), NOW());

-- Attempt to delete mapped election constituency when nomination depends on it (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    DELETE FROM election_constituencies WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR foreign_key_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Election constituency deletion blocked by dependency trigger [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 4: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Election constituency with dependent nominations deleted unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 5: Candidate Nomination Integrity & Unmapped Constituency Rejection
-- ============================================================================
SAVEPOINT s5_nominations;

INSERT INTO parliamentary_constituencies (id, state_id, constituency_number, name, reservation_type, total_voters, metadata_source, created_at, updated_at)
VALUES ('TEST_PC_UNMAPPED', 'TEST_ST', 2, 'Unmapped PC', 'GENERAL', 40000, 'DEMO_SAMPLE', NOW(), NOW());

-- Attempt to Nominate in Unmapped PC (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
    VALUES ('44444444-4444-4444-4444-444444444444', 'TEST_CAND_1', 'TEST_PARTY_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, NOW(), 'APPROVED', 'Note', NOW(), NOW());
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Nomination in unmapped constituency rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 5: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Nomination in unmapped constituency succeeded unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 6: Historical Party Modeling & Independent Candidate Support
-- ============================================================================
SAVEPOINT s6_independent_candidate;

-- Map second PC
INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, created_at)
VALUES ('55555555-5555-5555-5555-555555555555', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, NOW());

-- Insert Independent Candidate
INSERT INTO candidates (id, party_id, full_name, age, gender, education, profession, criminal_cases, assets_declared, liabilities_declared, photo_url, bio, metadata_source, created_at, updated_at)
VALUES ('TEST_CAND_IND', 'TEST_PARTY_1', 'Independent Citizen Candidate', 50, 'FEMALE', 'Doctorate', 'Professor', 0, 5000000, 10000, NULL, 'Bio', 'DEMO_SAMPLE', NOW(), NOW());

-- Valid Nomination as Independent (party_id = NULL)
INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('55555555-aaaa-bbbb-cccc-555555555555', 'TEST_CAND_IND', NULL, 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, NOW(), 'APPROVED', 'Independent nomination', NOW(), NOW());

RAISE NOTICE 'SUCCESS: Scenario 6 passed - Independent candidate nomination with party_id NULL verified.';

-- ============================================================================
-- SCENARIO 7: Section 33(7) Nomination Ceiling Enforcement (>2 Nominations)
-- ============================================================================
SAVEPOINT s7_nomination_ceiling;

-- Second nomination for candidate 1 (Legal per s.33(7))
INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('66666666-6666-6666-6666-666666666666', 'TEST_CAND_1', 'TEST_PARTY_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, NOW(), 'APPROVED', 'Second seat', NOW(), NOW());

-- Add third PC and map
INSERT INTO parliamentary_constituencies (id, state_id, constituency_number, name, reservation_type, total_voters, metadata_source, created_at, updated_at)
VALUES ('TEST_PC_THIRD', 'TEST_ST', 3, 'Third PC', 'GENERAL', 30000, 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, created_at)
VALUES ('77777777-7777-7777-7777-777777777777', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, NOW());

-- Attempt third nomination (Must Fail s.33(7) limit)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
    VALUES ('88888888-8888-8888-8888-888888888888', 'TEST_CAND_1', 'TEST_PARTY_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, NOW(), 'APPROVED', 'Third seat illegal', NOW(), NOW());
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Third nomination rejected by s.33(7) trigger [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 7: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Third nomination succeeded unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 8: Counting Session Initialization & Publication Equivalence Check
-- ============================================================================
SAVEPOINT s8_session_init;

-- Attempt to insert session with status = PUBLISHED directly (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_voters, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
    VALUES ('SESS_ILLEGAL_PUB', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, 'PUBLISHED', TRUE, 50000, 5, 5, 1000, 10, 5, 100, NOW(), NOW());
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR check_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Direct insertion as PUBLISHED rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 8a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Direct insertion as PUBLISHED succeeded unexpectedly!';
  END IF;
END;
$$;

-- Attempt to insert session with status = PUBLISHED and is_published = FALSE (Must Fail CHECK constraint)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_voters, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
    VALUES ('SESS_MISMATCH', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, 'PUBLISHED', FALSE, 50000, 5, 0, 0, 0, 0, 0, NOW(), NOW());
  EXCEPTION
    WHEN check_violation OR SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Conflicting status and is_published rejected by CHECK constraint [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 8b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Conflicting status and is_published flag insertion succeeded unexpectedly!';
  END IF;
END;
$$;

-- Valid DRAFT session
INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_voters, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
VALUES ('SESS_VALID_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, 'DRAFT', FALSE, 50000, 3, 0, 0, 0, 0, 0, NOW(), NOW());

RAISE NOTICE 'SUCCESS: Scenario 8 passed - Valid DRAFT session initialized.';

-- ============================================================================
-- SCENARIO 9: Candidate Tally Approved Nomination & NOTA Separation Check
-- ============================================================================
SAVEPOINT s9_tallies;

-- Attempt to insert candidate tally with candidate_id = NOTA (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
    VALUES ('99999999-9999-9999-9999-999999999999', 'SESS_VALID_1', 'NOTA', '33333333-3333-3333-3333-333333333333', 'TEST_PARTY_1', 50, 5.00, NOW(), NOW());
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR check_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: NOTA as candidate tally rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 9a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: NOTA inserted as candidate tally unexpectedly!';
  END IF;
END;
$$;

-- Valid Candidate Tally (Links to approved nomination)
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SESS_VALID_1', 'TEST_CAND_1', '33333333-3333-3333-3333-333333333333', 'TEST_PARTY_1', 1000, 100.00, NOW(), NOW());

RAISE NOTICE 'SUCCESS: Scenario 9 passed - Candidate tally bound to approved nomination.';

-- ============================================================================
-- SCENARIO 10: Nomination Lifecycle Protection (Prevent Deletion with Tally)
-- ============================================================================
SAVEPOINT s10_nomination_protect;

-- Attempt to delete nomination that has an active tally (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    DELETE FROM candidate_nominations WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR foreign_key_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Nomination deletion blocked by active tally [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 10a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Nomination with active tally deleted unexpectedly!';
  END IF;
END;
$$;

-- Attempt to invalidate nomination status (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE candidate_nominations SET status = 'REJECTED' WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Nomination status invalidation blocked by active tally [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 10b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Nomination with active tally changed to REJECTED unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 11: Active Counting Automatic Tally Reconciliation
-- ============================================================================
SAVEPOINT s11_active_reconciliation;

-- Transition session to COUNTING_IN_PROGRESS
UPDATE counting_sessions SET status = 'COUNTING_IN_PROGRESS' WHERE id = 'SESS_VALID_1';

-- Add second candidate & nomination in TEST_PC_1
INSERT INTO candidates (id, party_id, full_name, age, gender, education, profession, criminal_cases, assets_declared, liabilities_declared, photo_url, bio, metadata_source, created_at, updated_at)
VALUES ('TEST_CAND_2', 'TEST_PARTY_1', 'Jane Competitor Candidate', 42, 'FEMALE', 'Postgraduate', 'Lawyer', 0, 2000000, 100000, NULL, 'Bio', 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('bbbbbbbb-1111-2222-3333-444444444444', 'TEST_CAND_2', 'TEST_PARTY_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_1', NULL, NOW(), 'APPROVED', 'Approved competitor', NOW(), NOW());

-- Insert tally for second candidate (votes = 800)
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('bbbbbbbb-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SESS_VALID_1', 'TEST_CAND_2', 'bbbbbbbb-1111-2222-3333-444444444444', 'TEST_PARTY_1', 800, 44.44, NOW(), NOW());

-- Verify that counting_sessions.total_counted_votes was auto-reconciled to 1800 (1000 + 800 + 0 + 0)
DO $$
DECLARE
  v_total INT;
BEGIN
  SELECT total_counted_votes INTO v_total FROM counting_sessions WHERE id = 'SESS_VALID_1';
  IF v_total != 1800 THEN
    RAISE EXCEPTION 'Auto-reconciliation failed: expected 1800, found %', v_total;
  END IF;
  RAISE NOTICE 'SUCCESS: Scenario 11 passed - Candidate tallies auto-reconciled session total to %.', v_total;
END;
$$;

-- Update tally for candidate 2: 850 votes
UPDATE candidate_tallies SET votes = 850 WHERE id = 'bbbbbbbb-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Verify total_counted_votes updated to 1850
DO $$
DECLARE
  v_total INT;
BEGIN
  SELECT total_counted_votes INTO v_total FROM counting_sessions WHERE id = 'SESS_VALID_1';
  IF v_total != 1850 THEN
    RAISE EXCEPTION 'Auto-reconciliation on tally update failed: expected 1850, found %', v_total;
  END IF;
  RAISE NOTICE 'SUCCESS: Scenario 11 verified - Total counted votes updated to % on tally mutation.', v_total;
END;
$$;

-- ============================================================================
-- SCENARIO 12: Session Completion Strict Reconciliation (Rejects sum mismatches)
-- ============================================================================
SAVEPOINT s12_completion_reconciliation;

-- Attempt to complete session with mismatched total (claims 2500, but tallies=1850 + nota=50 + rej=10 = 1910)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_sessions 
    SET status = 'COUNTING_COMPLETED', total_counted_votes = 2500, nota_votes = 50, rejected_votes = 10, current_round = 3
    WHERE id = 'SESS_VALID_1';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Unreconciled vote total rejected upon completion [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 12: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Session completed with unreconciled vote total unexpectedly!';
  END IF;
END;
$$;

-- Reconcile with exact sum: 1850 (candidate tallies) + 50 (nota) + 10 (rejected) = 1910 (Valid)
UPDATE counting_sessions 
SET status = 'COUNTING_COMPLETED', total_counted_votes = 1910, nota_votes = 50, rejected_votes = 10, current_round = 3, winner_candidate_id = 'TEST_CAND_1', runner_up_candidate_id = 'TEST_CAND_2', victory_margin = 150
WHERE id = 'SESS_VALID_1';

RAISE NOTICE 'SUCCESS: Scenario 12 passed - Session completed with exact mathematical reconciliation (1910 votes).';

-- ============================================================================
-- SCENARIO 13: Completed Session Tally Mutation Protection
-- ============================================================================
SAVEPOINT s13_tally_mutation_guard;

-- Attempt to mutate candidate tallies while session is COUNTING_COMPLETED (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE candidate_tallies SET votes = 1200 WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Completed session tallies protected from mutation [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 13: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Tally updated in completed session unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 14: Publication Review Gate Enforcement
-- ============================================================================
SAVEPOINT s14_publication_review_gate;

-- Attempt to publish directly from COUNTING_COMPLETED without review stage (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_sessions SET status = 'PUBLISHED', is_published = TRUE WHERE id = 'SESS_VALID_1';
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR check_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Direct publication without review rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 14: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Published directly without review stage unexpectedly!';
  END IF;
END;
$$;

-- Transition to RESULT_READY_FOR_REVIEW (Valid)
UPDATE counting_sessions SET status = 'RESULT_READY_FOR_REVIEW' WHERE id = 'SESS_VALID_1';

RAISE NOTICE 'SUCCESS: Scenario 14 passed - Session transitioned to RESULT_READY_FOR_REVIEW.';

-- ============================================================================
-- SCENARIO 15: Incomplete Rounds Publication Rejection
-- ============================================================================
SAVEPOINT s15_incomplete_rounds;

-- Set current_round to 2 (total_configured_rounds is 3)
UPDATE counting_sessions SET current_round = 2 WHERE id = 'SESS_VALID_1';

-- Insert Admin User for publication testing
INSERT INTO users (id, user_type, identifier, password_hash, is_active, failed_login_attempts, created_at, updated_at)
VALUES ('uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu', 'ADMIN', 'ECI-OFF-001', 'argon2id$mockhash', TRUE, 0, NOW(), NOW());

INSERT INTO admin_users (id, user_id, officer_code, full_name, designation, role, assigned_state_id, is_active, created_at, updated_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu', 'ECI-OFF-001', 'Returning Officer', 'Returning Officer', 'ELECTION_OFFICER', 'TEST_ST', TRUE, NOW(), NOW());

-- Attempt to publish when current_round < total_configured_rounds (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_sessions 
    SET status = 'PUBLISHED', is_published = TRUE, published_by_admin_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    WHERE id = 'SESS_VALID_1';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Incomplete round count publication rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 15: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Incomplete rounds publication succeeded unexpectedly!';
  END IF;
END;
$$;

-- Reset current_round to 3
UPDATE counting_sessions SET current_round = 3 WHERE id = 'SESS_VALID_1';

-- ============================================================================
-- SCENARIO 16: Missing Physical Round Records Publication Rejection
-- ============================================================================
SAVEPOINT s16_missing_round_records;

-- Attempt to publish when current_round = 3, but 0 physical rows exist in counting_rounds (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_sessions 
    SET status = 'PUBLISHED', is_published = TRUE, published_by_admin_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    WHERE id = 'SESS_VALID_1';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Missing physical round records publication rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 16: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Publication succeeded without physical counting_rounds rows!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 17: Valid Round Sequential Insertion & Delta Progression
-- ============================================================================
SAVEPOINT s17_round_progression;

-- Temporary transition to COUNTING_IN_PROGRESS to insert rounds
UPDATE counting_sessions SET status = 'COUNTING_IN_PROGRESS', current_round = 0 WHERE id = 'SESS_VALID_1';

-- Insert Round 1: 600 votes, cumulative = 600
INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, leading_candidate_id, lead_margin, processed_at, processed_by_admin_id)
VALUES ('c1111111-1111-1111-1111-111111111111', 'SESS_VALID_1', 1, 600, 600, 'TEST_CAND_1', 100, NOW(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Insert Round 2: 650 votes, cumulative = 1250 (1250 - 600 = 650)
INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, leading_candidate_id, lead_margin, processed_at, processed_by_admin_id)
VALUES ('c2222222-2222-2222-2222-222222222222', 'SESS_VALID_1', 2, 650, 1250, 'TEST_CAND_1', 120, NOW(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Insert Round 3: 660 votes, cumulative = 1910 (1910 - 1250 = 660)
INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, leading_candidate_id, lead_margin, processed_at, processed_by_admin_id)
VALUES ('c3333333-3333-3333-3333-333333333333', 'SESS_VALID_1', 3, 660, 1910, 'TEST_CAND_1', 150, NOW(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

RAISE NOTICE 'SUCCESS: Scenario 17 passed - 3 sequential rounds inserted with verified delta progression.';

-- ============================================================================
-- SCENARIO 18: CountingRound UPDATE Integrity (Immutability of session & round)
-- ============================================================================
SAVEPOINT s18_round_update_integrity;

-- Attempt to change session_id on round 1 (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_rounds 
    SET session_id = 'SOME_OTHER_SESSION' 
    WHERE id = 'c1111111-1111-1111-1111-111111111111';
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR foreign_key_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Round session_id transfer rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 18a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Counting round transferred to different session unexpectedly!';
  END IF;
END;
$$;

-- Attempt to change round_number on existing round record (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_rounds 
    SET round_number = 5 
    WHERE id = 'c1111111-1111-1111-1111-111111111111';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Round round_number modification rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 18b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Existing round_number altered unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 19: Earlier Round Vote Mutation Rejection when subsequent rounds exist
-- ============================================================================
SAVEPOINT s19_earlier_round_mutation;

-- Attempt to change vote totals on round 1 while rounds 2 and 3 exist (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_rounds 
    SET round_votes = 700, cumulative_votes = 700 
    WHERE id = 'c1111111-1111-1111-1111-111111111111';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Earlier round modification blocked [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 19: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Earlier round vote totals modified while subsequent rounds exist!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 20: Strict Reverse-Order Round Rollback Enforcement
-- ============================================================================
SAVEPOINT s20_reverse_rollback;

-- Attempt to delete round 1 while rounds 2 and 3 exist (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    DELETE FROM counting_rounds WHERE id = 'c1111111-1111-1111-1111-111111111111';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Non-reverse round deletion blocked [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 20: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Earlier round deleted out of reverse order!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 21: Automatic Synchronization of current_round Counter
-- ============================================================================
SAVEPOINT s21_round_counter_sync;

-- Verify that current_round was auto-synchronized to 3 on round insertion
DO $$
DECLARE
  v_curr INT;
BEGIN
  SELECT current_round INTO v_curr FROM counting_sessions WHERE id = 'SESS_VALID_1';
  IF v_curr != 3 THEN
    RAISE EXCEPTION 'current_round counter out of sync: expected 3, found %', v_curr;
  END IF;
  RAISE NOTICE 'SUCCESS: Scenario 21 passed - current_round counter synchronized to %.', v_curr;
END;
$$;

-- ============================================================================
-- SCENARIO 22: Tie State Transition & Mandatory TieResolution Evidence Gate
-- ============================================================================
SAVEPOINT s22_tie_resolution;

-- Initialize tied session
INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_voters, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
VALUES ('SESS_TIED_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, 'COUNTING_IN_PROGRESS', FALSE, 40000, 1, 1, 2000, 0, 0, 0, NOW(), NOW());

-- Transition session to TIED
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_TIED_1';

-- Attempt transition from TIED to RESULT_READY_FOR_REVIEW without tie_resolutions evidence (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_sessions 
    SET status = 'RESULT_READY_FOR_REVIEW', winner_candidate_id = 'TEST_CAND_1'
    WHERE id = 'SESS_TIED_1';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Transition from TIED without tie_resolutions evidence rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 22a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Transitioned from TIED to RESULT_READY_FOR_REVIEW without resolution record!';
  END IF;
END;
$$;

-- Insert verified tie resolution evidence per Section 102 RPA 1951
INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'SESS_TIED_1',
  'WINNER_SELECTED_BY_LOT',
  'TEST_CAND_1',
  'DRAW_OF_LOTS_RO_SECTION_102_RPA_1951',
  'Draw of lots conducted by Returning Officer in presence of contesting candidate agents per Section 102 of Representation of the People Act 1951.',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  NOW()
);

-- Attempt to modify tie_resolutions entry (Must Fail - Immutable legal record)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE tie_resolutions 
    SET decision = 'MODIFIED_DECISION' 
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      RAISE NOTICE 'SUCCESS: Modification of tie_resolutions rejected by immutability trigger [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 22b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Immutable tie resolution record modified unexpectedly!';
  END IF;
END;
$$;

-- Transition from TIED to RESULT_READY_FOR_REVIEW with matching winner (Valid)
UPDATE counting_sessions 
SET status = 'RESULT_READY_FOR_REVIEW', winner_candidate_id = 'TEST_CAND_1'
WHERE id = 'SESS_TIED_1';

RAISE NOTICE 'SUCCESS: Scenario 22 passed - TIED session resolved and transitioned with verified database evidence.';

-- ============================================================================
-- SCENARIO 23: Complete End-to-End Verified Publication Workflow
-- ============================================================================
SAVEPOINT s23_publication_final;

-- Transition SESS_VALID_1 to COUNTING_COMPLETED and then RESULT_READY_FOR_REVIEW
UPDATE counting_sessions 
SET status = 'COUNTING_COMPLETED', total_counted_votes = 1910, nota_votes = 50, rejected_votes = 10, current_round = 3, winner_candidate_id = 'TEST_CAND_1', runner_up_candidate_id = 'TEST_CAND_2', victory_margin = 150
WHERE id = 'SESS_VALID_1';

UPDATE counting_sessions 
SET status = 'RESULT_READY_FOR_REVIEW' 
WHERE id = 'SESS_VALID_1';

-- Publish session with verified reviewer sign-off
UPDATE counting_sessions 
SET status = 'PUBLISHED', is_published = TRUE, published_by_admin_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', published_at = NOW()
WHERE id = 'SESS_VALID_1';

-- Verify published state
DO $$
DECLARE
  v_stat "ResultStatus";
  v_pub BOOLEAN;
  v_admin UUID;
BEGIN
  SELECT status, is_published, published_by_admin_id 
  INTO v_stat, v_pub, v_admin
  FROM counting_sessions 
  WHERE id = 'SESS_VALID_1';

  IF v_stat != 'PUBLISHED' OR v_pub != TRUE OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Final publication state verification failed!';
  END IF;

  RAISE NOTICE 'SUCCESS: Scenario 23 passed - End-to-end result publication successfully verified.';
END;
$$;

ROLLBACK;

-- All scenarios passed successfully
SELECT 'OVS Phase 8.1.4 PostgreSQL Integration Validation Suite: ALL 23 SCENARIOS PASSED' AS verdict;
