-- ============================================================================
-- Online Voting System (OVS) — PostgreSQL 16+ Integration Validation Suite
-- Phase 8.1.6: Final Tie Integrity, Publication Workflow & PostgreSQL CI Verification
-- ============================================================================
-- COMPLETE REPRODUCIBLE 5-STEP EXECUTION SEQUENCE (DISPOSABLE POSTGRESQL 16 DB):
-- Do NOT execute this script before creating the Prisma base schema and applying
-- CUSTOM_DATABASE_INTEGRITY.sql. Run in exact order:
--
--   1. Create disposable PostgreSQL 16 database:
--      export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ovs_validation_db?schema=public"
--      psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ovs_validation_db;"
--      psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ovs_validation_db;"
--
--   2. Validate & apply Prisma schema (creates all 25 tables and 17 enums using pinned Prisma CLI):
--      npx --yes prisma@6.4.1 validate --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma
--      npx --yes prisma@6.4.1 db push --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma --skip-generate
--
--   3. Apply custom SQL integrity constraints and triggers:
--      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql
--
--   4. Execute this PostgreSQL integration validation suite:
--      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql
--
--   5. Clean up disposable database:
--      psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ovs_validation_db WITH (FORCE);"
-- ============================================================================
-- SCHEMA ALIGNMENT & ASSERTION QUALITY NOTE:
-- All table names, column names, and enum values strictly match the physical
-- PostgreSQL mappings defined in docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma.
-- All negative tests use subtransaction assertion blocks catching specific SQLSTATEs
-- AND verifying the specific expected constraint name or trigger message.
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

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 1 passed - Valid geographic hierarchy inserted.'; END $$;

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
  v_err_constraint TEXT;
BEGIN
  BEGIN
    INSERT INTO assembly_constituencies (id, state_id, district_id, parent_parliamentary_constituency_id, constituency_number, name, reservation_type, total_voters, metadata_source, created_at, updated_at)
    VALUES ('TEST_AC_INVALID', 'TEST_ST_2', 'TEST_DIST_1', 'TEST_PC_1', 99, 'Invalid AC', 'GENERAL', 10000, 'DEMO_SAMPLE', NOW(), NOW());
  EXCEPTION
    WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT, v_err_constraint = CONSTRAINT_NAME;
      IF v_err_constraint NOT IN ('fk_ac_district_state', 'fk_ac_parent_pc_state', 'assembly_constituencies_district_id_state_id_fkey', 'assembly_constituencies_parent_parliamentary_constituency__fkey')
         AND v_err_msg NOT LIKE '%fk_ac_%' AND v_err_msg NOT LIKE '%foreign key constraint%' THEN
        RAISE EXCEPTION 'Scenario 2 caught unexpected FK error: constraint=%, msg=%', v_err_constraint, v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: Cross-state AC rejected by composite foreign key (%) [%]: %', v_err_constraint, v_err_sqlstate, v_err_msg;
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
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%Lok Sabha election%cannot map to non-parliamentary%' AND v_err_msg NOT LIKE '%chk_election_constituency_type_exclusivity%' THEN
        RAISE EXCEPTION 'Scenario 3 caught unexpected error message: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
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
      IF v_err_msg NOT LIKE '%dependent candidate nominations exist%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 4: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%is not mapped to election%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 5: %', v_err_msg;
      END IF;
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

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 6 passed - Independent candidate nomination with party_id NULL verified.'; END $$;

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
      IF v_err_msg NOT LIKE '%exceeds statutory limit of 2 nominations%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 7: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%cannot be directly inserted as PUBLISHED%' AND v_err_msg NOT LIKE '%chk_counting_session_initial_draft%' THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR MESSAGE in Scenario 8a: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%chk_counting_session_publication_equivalence%' AND v_err_msg NOT LIKE '%cannot be directly inserted as PUBLISHED%' THEN
        RAISE EXCEPTION 'UNEXPECTED ERROR MESSAGE in Scenario 8b: %', v_err_msg;
      END IF;
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

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 8 passed - Valid DRAFT session initialized.'; END $$;

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
      IF v_err_msg NOT LIKE '%NOTA must not be tallied as a candidate%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 9a: %', v_err_msg;
      END IF;
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

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 9 passed - Candidate tally bound to approved nomination.'; END $$;

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
      IF v_err_msg NOT LIKE '%dependent counting tallies exist%' AND v_err_msg NOT LIKE '%fk_tally_nomination%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 10a: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%active candidate tallies exist in counting session%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 10b: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%Vote reconciliation error%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 12: %', v_err_msg;
      END IF;
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

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 12 passed - Session completed with exact mathematical reconciliation (1910 votes).'; END $$;

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
      IF v_err_msg NOT LIKE '%Cannot UPDATE candidate tallies: session%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 13: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%Must proceed to RESULT_READY_FOR_REVIEW%' AND v_err_msg NOT LIKE '%must be reviewed in RESULT_READY_FOR_REVIEW%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 14: %', v_err_msg;
      END IF;
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

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 14 passed - Session transitioned to RESULT_READY_FOR_REVIEW.'; END $$;

-- ============================================================================
-- SCENARIO 15: Incomplete Rounds Publication Rejection
-- ============================================================================
SAVEPOINT s15_incomplete_rounds;

-- Set current_round to 2 (total_configured_rounds is 3)
UPDATE counting_sessions SET current_round = 2 WHERE id = 'SESS_VALID_1';

-- Insert Admin User for publication testing
INSERT INTO users (id, user_type, identifier, password_hash, is_active, failed_login_attempts, created_at, updated_at)
VALUES ('00000001-1111-1111-1111-111111111111', 'ADMIN', 'ECI-OFF-001', 'argon2id$mockhash', TRUE, 0, NOW(), NOW());

INSERT INTO admin_users (id, user_id, officer_code, full_name, designation, role, assigned_state_id, is_active, created_at, updated_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000001-1111-1111-1111-111111111111', 'ECI-OFF-001', 'Returning Officer', 'Returning Officer', 'ELECTION_OFFICER', 'TEST_ST', TRUE, NOW(), NOW());

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
      IF v_err_msg NOT LIKE '%counting is incomplete%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 15: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%configured counting round records exist%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 16: %', v_err_msg;
      END IF;
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

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 17 passed - 3 sequential rounds inserted with verified delta progression.'; END $$;

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
      IF v_err_msg NOT LIKE '%Cannot transfer counting round%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 18a: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%Cannot modify round_number%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 18b: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%Cannot modify vote totals for earlier round%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 19: %', v_err_msg;
      END IF;
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
      IF v_err_msg NOT LIKE '%Rounds must be deleted in strict reverse order%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 20: %', v_err_msg;
      END IF;
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

-- Assign election scope to Returning Officer bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb for TEST_ELEC_LS
INSERT INTO admin_election_scopes (id, admin_user_id, election_id, assigned_at)
VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TEST_ELEC_LS', NOW());

-- Initialize tied session in DRAFT first (per initial state invariant)
INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_voters, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
VALUES ('SESS_TIED_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_UNMAPPED', NULL, 'DRAFT', FALSE, 40000, 1, 0, 0, 0, 0, 0, NOW(), NOW());

-- Transition to COUNTING_IN_PROGRESS and record tied tallies (1000 each for TEST_CAND_1 and TEST_CAND_IND) and Round 1
UPDATE counting_sessions SET status = 'COUNTING_IN_PROGRESS' WHERE id = 'SESS_TIED_1';

INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('cccccccc-1111-1111-1111-111111111111', 'SESS_TIED_1', 'TEST_CAND_1', '66666666-6666-6666-6666-666666666666', 'TEST_PARTY_1', 1000, 50.00, NOW(), NOW());

INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('cccccccc-2222-2222-2222-222222222222', 'SESS_TIED_1', 'TEST_CAND_IND', '55555555-aaaa-bbbb-cccc-555555555555', NULL, 1000, 50.00, NOW(), NOW());

INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, leading_candidate_id, lead_margin, processed_at, processed_by_admin_id)
VALUES ('c4444444-4444-4444-4444-444444444444', 'SESS_TIED_1', 1, 2000, 2000, 'TEST_CAND_1', 0, NOW(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

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
      IF v_err_msg NOT LIKE '%requires verified database evidence in tie_resolutions%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 22a: %', v_err_msg;
      END IF;
      RAISE NOTICE 'SUCCESS: Transition from TIED without tie_resolutions evidence rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 22a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Transitioned from TIED to RESULT_READY_FOR_REVIEW without resolution record!';
  END IF;
END;
$$;

-- Insert verified simulated tie resolution evidence
INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'SESS_TIED_1',
  'WINNER_SELECTED_BY_LOT',
  'TEST_CAND_1',
  'SIMULATED_DRAW_OF_LOTS',
  'Simulated educational draw of lots conducted by Returning Officer in presence of contesting candidate agents.',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  NOW()
);

-- Attempt to modify tie_resolutions entry (Must Fail - Immutable audit record)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE tie_resolutions 
    SET decision = 'SIMULATED_DRAW_WINNER_DECLARED' 
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%Tie resolution records are immutable audit evidence%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 22b: %', v_err_msg;
      END IF;
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
SET status = 'RESULT_READY_FOR_REVIEW', winner_candidate_id = 'TEST_CAND_1', runner_up_candidate_id = 'TEST_CAND_IND'
WHERE id = 'SESS_TIED_1';

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 22 passed - TIED session resolved and transitioned with verified database evidence.'; END $$;

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

-- ============================================================================
-- SCENARIO 24: Obsolete Round Leader Column Absence & Valid leading_candidate_id Check
-- ============================================================================
SAVEPOINT s24_leading_candidate_id_verification;

-- 24a: Verify via information_schema and pg_proc that leading_candidate_id exists and obsolete column is absent
DO $$
DECLARE
  v_valid_col_count INT;
  v_obsolete_col_count INT;
  v_obsolete_proc_count INT;
BEGIN
  SELECT COUNT(*) INTO v_valid_col_count
  FROM information_schema.columns
  WHERE table_name = 'counting_rounds' AND column_name = 'leading_candidate_id';

  SELECT COUNT(*) INTO v_obsolete_col_count
  FROM information_schema.columns
  WHERE table_name = 'counting_rounds' AND column_name = ('lead' || '_candidate_id');

  SELECT COUNT(*) INTO v_obsolete_proc_count
  FROM pg_proc
  WHERE proname = 'verify_counting_round_progression'
    AND prosrc LIKE '%' || 'lead' || '_candidate_id%';

  IF v_valid_col_count != 1 OR v_obsolete_col_count != 0 OR v_obsolete_proc_count != 0 THEN
    RAISE EXCEPTION 'Schema/trigger field audit failed: valid=%, obsolete_col=%, obsolete_proc=%',
      v_valid_col_count, v_obsolete_col_count, v_obsolete_proc_count;
  END IF;

  RAISE NOTICE 'SUCCESS: Scenario 24a passed - leading_candidate_id verified and obsolete field reference absent.';
END;
$$;

-- 24b: Verify round leader validation rejects unapproved candidate on leading_candidate_id
INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_voters, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
VALUES ('SESS_PC3_ACTIVE', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, 'DRAFT', FALSE, 30000, 2, 0, 0, 0, 0, 0, NOW(), NOW());

UPDATE counting_sessions SET status = 'COUNTING_IN_PROGRESS' WHERE id = 'SESS_PC3_ACTIVE';

DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    -- TEST_CAND_1 does NOT have an approved nomination in TEST_PC_THIRD
    INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, leading_candidate_id, lead_margin, processed_at, processed_by_admin_id)
    VALUES ('c5555555-5555-5555-5555-555555555555', 'SESS_PC3_ACTIVE', 1, 500, 500, 'TEST_CAND_1', 50, NOW(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%lacks an APPROVED nomination in session constituency%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 24b: %', v_err_msg;
      END IF;
      RAISE NOTICE 'SUCCESS: Unapproved round leader on leading_candidate_id rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 24b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Unapproved round leader on leading_candidate_id succeeded unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 25: Exact Historical Nomination-Party Consistency (IS NOT DISTINCT FROM)
-- ============================================================================
SAVEPOINT s25_historical_nomination_party;

-- Create second political party TEST_PARTY_2
INSERT INTO political_parties (id, name, abbreviation, party_type, symbol_name, symbol_url, established_year, headquarters, status, metadata_source, created_at, updated_at)
VALUES ('TEST_PARTY_2', 'Second Regional Party', 'SRP', 'STATE', 'Tree', 'https://example.com/tree.png', 1995, 'Test Capital', 'ACTIVE', 'DEMO_SAMPLE', NOW(), NOW());

-- Nominate TEST_CAND_2 in TEST_PC_THIRD under historical party TEST_PARTY_1
INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('77777777-aaaa-bbbb-cccc-777777777777', 'TEST_CAND_2', 'TEST_PARTY_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, NOW(), 'APPROVED', 'Party 1 nomination', NOW(), NOW());

-- Nominate TEST_CAND_IND in TEST_PC_THIRD as INDEPENDENT (party_id IS NULL)
INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('77777777-dddd-eeee-ffff-777777777777', 'TEST_CAND_IND', NULL, 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, NOW(), 'APPROVED', 'Independent nomination in PC 3', NOW(), NOW());

-- 25a: Attempt to insert tally for TEST_CAND_2 with mismatched party TEST_PARTY_2 (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
    VALUES ('dddddddd-1111-1111-1111-111111111111', 'SESS_PC3_ACTIVE', 'TEST_CAND_2', '77777777-aaaa-bbbb-cccc-777777777777', 'TEST_PARTY_2', 400, 50.00, NOW(), NOW());
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR foreign_key_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%does not match nomination party%' AND v_err_msg NOT LIKE '%fk_tally_nomination_candidate_party%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 25a: %', v_err_msg;
      END IF;
      RAISE NOTICE 'SUCCESS: Historical nomination party A with tally party B rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 25a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Tally with mismatched party B succeeded unexpectedly!';
  END IF;
END;
$$;

-- 25b: Attempt to insert tally for Independent candidate TEST_CAND_IND with non-NULL party (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
    VALUES ('dddddddd-2222-2222-2222-222222222222', 'SESS_PC3_ACTIVE', 'TEST_CAND_IND', '77777777-dddd-eeee-ffff-777777777777', 'TEST_PARTY_1', 300, 50.00, NOW(), NOW());
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%holds an INDEPENDENT nomination; tally party_id must be NULL%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 25b: %', v_err_msg;
      END IF;
      RAISE NOTICE 'SUCCESS: Independent nomination with non-NULL tally party rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 25b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Independent nomination accepted non-NULL tally party unexpectedly!';
  END IF;
END;
$$;

-- 25c: Insert valid tally for TEST_CAND_2 with matching party TEST_PARTY_1 and valid independent tally with NULL party
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('dddddddd-3333-3333-3333-333333333333', 'SESS_PC3_ACTIVE', 'TEST_CAND_2', '77777777-aaaa-bbbb-cccc-777777777777', 'TEST_PARTY_1', 500, 62.50, NOW(), NOW());

INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('dddddddd-4444-4444-4444-444444444444', 'SESS_PC3_ACTIVE', 'TEST_CAND_IND', '77777777-dddd-eeee-ffff-777777777777', NULL, 300, 37.50, NOW(), NOW());

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 25 passed - Exact nomination-party and independent NULL tally party verified.'; END $$;

-- ============================================================================
-- SCENARIO 26: Global Candidate Party Switch Without Historical Tally Corruption
-- ============================================================================
SAVEPOINT s26_global_party_change;

-- Candidate TEST_CAND_2 changes current global party from TEST_PARTY_1 to TEST_PARTY_2 for future elections
UPDATE candidates SET party_id = 'TEST_PARTY_2' WHERE id = 'TEST_CAND_2';

-- Verify historical tally in SESS_PC3_ACTIVE still retains historical nomination party TEST_PARTY_1
DO $$
DECLARE
  v_hist_party VARCHAR(50);
BEGIN
  SELECT party_id INTO v_hist_party
  FROM candidate_tallies
  WHERE id = 'dddddddd-3333-3333-3333-333333333333';

  IF v_hist_party != 'TEST_PARTY_1' THEN
    RAISE EXCEPTION 'Historical tally party corrupted after candidate global party switch: expected TEST_PARTY_1, found %', v_hist_party;
  END IF;
END;
$$;

-- Attempt to update historical tally in SESS_PC3_ACTIVE to use candidate's new global party TEST_PARTY_2 (Must Fail!)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE candidate_tallies
    SET party_id = 'TEST_PARTY_2'
    WHERE id = 'dddddddd-3333-3333-3333-333333333333';
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR foreign_key_violation THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%Global candidate party changes cannot override historical nomination affiliation%' AND v_err_msg NOT LIKE '%fk_tally_nomination_candidate_party%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 26: %', v_err_msg;
      END IF;
      RAISE NOTICE 'SUCCESS: Override of historical nomination party by new global party rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 26: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Candidate current global party overrode historical nomination party!';
  END IF;
END;
$$;

DO $$ BEGIN RAISE NOTICE 'SUCCESS: Scenario 26 passed - Global candidate party change preserved historical nomination party integrity.'; END $$;

-- ============================================================================
-- SCENARIO 27: CandidateTally Session Ownership Immutability & Old Session Total Preservation
-- ============================================================================
SAVEPOINT s27_tally_session_immutability;

-- Create a second active session in a new election to test session transfer rejection
INSERT INTO elections (id, name, type, year, state_id, status, polling_start_date, polling_end_date, counting_date, result_date, demo_sandbox_mode, description, metadata_source, created_at, updated_at)
VALUES ('TEST_ELEC_LS_2034', 'Lok Sabha 2034', 'LOK_SABHA', 2034, NULL, 'COUNTING', CURRENT_DATE + 1800, CURRENT_DATE + 1800, CURRENT_DATE + 1802, CURRENT_DATE + 1803, 'ACTIVE_SIMULATED', 'Future Election', 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO election_constituencies (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, created_at)
VALUES ('88888888-1111-2222-3333-888888888888', 'TEST_ELEC_LS_2034', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, NOW());

INSERT INTO counting_sessions (id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, status, is_published, total_voters, total_configured_rounds, current_round, total_counted_votes, nota_votes, rejected_votes, victory_margin, created_at, updated_at)
VALUES ('SESS_2034_PC3', 'TEST_ELEC_LS_2034', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, 'DRAFT', FALSE, 32000, 2, 0, 0, 0, 0, 0, NOW(), NOW());

UPDATE counting_sessions SET status = 'COUNTING_IN_PROGRESS' WHERE id = 'SESS_2034_PC3';

-- Attempt to transfer tally dddddddd-3333-3333-3333-333333333333 from SESS_PC3_ACTIVE to SESS_2034_PC3 (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE candidate_tallies
    SET session_id = 'SESS_2034_PC3'
    WHERE id = 'dddddddd-3333-3333-3333-333333333333';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_caught_expected_error := TRUE;
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%CandidateTally session_id is immutable after INSERT%' THEN
        RAISE EXCEPTION 'UNEXPECTED TRIGGER MESSAGE in Scenario 27: %', v_err_msg;
      END IF;
      RAISE NOTICE 'SUCCESS: CandidateTally session transfer rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 27: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: CandidateTally transferred between sessions unexpectedly!';
  END IF;
END;
$$;

-- Verify old session SESS_PC3_ACTIVE total_counted_votes remains unchanged at 800 (500 + 300)
DO $$
DECLARE
  v_old_total INT;
  v_new_total INT;
BEGIN
  SELECT total_counted_votes INTO v_old_total FROM counting_sessions WHERE id = 'SESS_PC3_ACTIVE';
  SELECT total_counted_votes INTO v_new_total FROM counting_sessions WHERE id = 'SESS_2034_PC3';

  IF v_old_total != 800 OR v_new_total != 0 THEN
    RAISE EXCEPTION 'Session totals corrupted after rejected transfer: old_session=%, new_session=%', v_old_total, v_new_total;
  END IF;

  RAISE NOTICE 'SUCCESS: Scenario 27 passed - Session ownership immutable and old session total unchanged (%).', v_old_total;
END;
$$;

-- ============================================================================
-- SCENARIO 28: Genuine Tie Validation (8 Required Tie-Integrity Test Cases)
-- ============================================================================
SAVEPOINT s28_tie_resolution_validation;

-- Add a third candidate TEST_CAND_3 and nominate in TEST_PC_THIRD for multi-candidate tie tests
INSERT INTO candidates (id, party_id, full_name, age, gender, education, profession, criminal_cases, assets_declared, liabilities_declared, photo_url, bio, metadata_source, created_at, updated_at)
VALUES ('TEST_CAND_3', 'TEST_PARTY_1', 'Third Contesting Candidate', 39, 'MALE', 'Postgraduate', 'Economist', 0, 1500000, 20000, NULL, 'Bio', 'DEMO_SAMPLE', NOW(), NOW());

INSERT INTO candidate_nominations (id, candidate_id, party_id, election_id, constituency_type, parliamentary_constituency_id, assembly_constituency_id, nomination_date, status, scrutiny_note, created_at, updated_at)
VALUES ('77777777-3333-3333-3333-777777777777', 'TEST_CAND_3', 'TEST_PARTY_1', 'TEST_ELEC_LS', 'PARLIAMENTARY', 'TEST_PC_THIRD', NULL, NOW(), 'APPROVED', 'Third candidate approved in PC 3', NOW(), NOW());

-- 28a: Attempt TieResolution insertion into non-TIED session SESS_PC3_ACTIVE (status = COUNTING_IN_PROGRESS) (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-1111-2222-3333-444444444444',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted resolution on a session that is not in TIED status.',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%must be in TIED status%' THEN
        RAISE EXCEPTION 'Scenario 28a failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution into non-TIED session rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution inserted into non-TIED session unexpectedly!';
  END IF;
END;
$$;

-- 28b: No candidate tallies — rejected (Requirement 2 #6)
SAVEPOINT s28b_no_tallies;
DELETE FROM candidate_tallies WHERE session_id = 'SESS_PC3_ACTIVE';
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-2800-0000-0000-000000000001',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted tie resolution when no candidate tallies exist in session.',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%no candidate tallies exist for session%' THEN
        RAISE EXCEPTION 'Scenario 28b failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution with no candidate tallies rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution succeeded when no candidate tallies exist!';
  END IF;
END;
$$;
ROLLBACK TO SAVEPOINT s28b_no_tallies;

-- 28c: Zero votes for all candidates — rejected (Requirement 2 #5)
SAVEPOINT s28c_zero_votes;
UPDATE candidate_tallies SET votes = 0, vote_share_percentage = 0.00 WHERE session_id = 'SESS_PC3_ACTIVE';
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-2800-0000-0000-000000000002',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted tie resolution when all candidates have zero votes.',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%maximum vote count among eligible APPROVED candidates in session%must be greater than zero%' THEN
        RAISE EXCEPTION 'Scenario 28c failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution with zero votes for all candidates rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28c: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution succeeded when all candidates had zero votes!';
  END IF;
END;
$$;
ROLLBACK TO SAVEPOINT s28c_zero_votes;

-- 28d: Single candidate with highest votes (only 1 candidate tally in session) — rejected (Requirement 2 #3)
SAVEPOINT s28d_single_candidate;
DELETE FROM candidate_tallies WHERE id = 'dddddddd-4444-4444-4444-444444444444';
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-2800-0000-0000-000000000003',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted tie resolution when only a single candidate has votes.',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%genuine tie requires at least 2 eligible APPROVED candidates tied at highest votes%v_top_tied_count = 1%' THEN
        RAISE EXCEPTION 'Scenario 28d failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution with single candidate rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28d: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution succeeded with only a single candidate!';
  END IF;
END;
$$;
ROLLBACK TO SAVEPOINT s28d_single_candidate;

-- 28e: Unique highest candidate among multiple candidates (600 vs 400 vs 400) — rejected (Requirement 2 #4)
SAVEPOINT s28e_unique_highest;
UPDATE candidate_tallies SET votes = 600, vote_share_percentage = 42.86 WHERE id = 'dddddddd-3333-3333-3333-333333333333'; -- TEST_CAND_2 = 600
UPDATE candidate_tallies SET votes = 400, vote_share_percentage = 28.57 WHERE id = 'dddddddd-4444-4444-4444-444444444444'; -- TEST_CAND_IND = 400
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('dddddddd-5555-5555-5555-555555555555', 'SESS_PC3_ACTIVE', 'TEST_CAND_3', '77777777-3333-3333-3333-777777777777', 'TEST_PARTY_1', 400, 28.57, NOW(), NOW());
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-2800-0000-0000-000000000004',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted tie resolution when TEST_CAND_2 has a unique highest vote total (600 vs 400 vs 400).',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%genuine tie requires at least 2 eligible APPROVED candidates tied at highest votes (600)%v_top_tied_count = 1%' THEN
        RAISE EXCEPTION 'Scenario 28e failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution with unique highest candidate rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28e: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution succeeded when one candidate had a unique highest vote total!';
  END IF;
END;
$$;
ROLLBACK TO SAVEPOINT s28e_unique_highest;

-- 28f: Selected winner not among tied candidates (500 vs 500 vs 300, selecting 300-vote candidate) — rejected (Requirement 2 #7)
SAVEPOINT s28f_winner_not_in_tie;
UPDATE candidate_tallies SET votes = 500, vote_share_percentage = 38.46 WHERE id = 'dddddddd-3333-3333-3333-333333333333'; -- TEST_CAND_2 = 500
UPDATE candidate_tallies SET votes = 500, vote_share_percentage = 38.46 WHERE id = 'dddddddd-4444-4444-4444-444444444444'; -- TEST_CAND_IND = 500
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('dddddddd-5555-5555-5555-555555555555', 'SESS_PC3_ACTIVE', 'TEST_CAND_3', '77777777-3333-3333-3333-777777777777', 'TEST_PARTY_1', 300, 23.08, NOW(), NOW());
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-2800-0000-0000-000000000005',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_3',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted tie resolution selecting third-place candidate TEST_CAND_3 (300 votes) instead of tied leaders (500 votes).',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%selected winner TEST_CAND_3 (votes: 300) is not tied for the highest vote total (500)%' THEN
        RAISE EXCEPTION 'Scenario 28f failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution selecting non-tied candidate rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28f: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution accepted winner not among tied top candidates!';
  END IF;
END;
$$;
ROLLBACK TO SAVEPOINT s28f_winner_not_in_tie;

-- 28g: Unapproved candidate included in highest-vote comparison — rejected (Requirement 2 #8)
SAVEPOINT s28g_unapproved_candidate_tie;
UPDATE candidate_tallies SET votes = 500, vote_share_percentage = 38.46 WHERE id = 'dddddddd-3333-3333-3333-333333333333'; -- TEST_CAND_2 (APPROVED) = 500
UPDATE candidate_tallies SET votes = 300, vote_share_percentage = 23.08 WHERE id = 'dddddddd-4444-4444-4444-444444444444'; -- TEST_CAND_IND (APPROVED) = 300
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('dddddddd-5555-5555-5555-555555555555', 'SESS_PC3_ACTIVE', 'TEST_CAND_3', '77777777-3333-3333-3333-777777777777', 'TEST_PARTY_1', 500, 38.46, NOW(), NOW());
-- Place TEST_CAND_3 nomination into UNDER_REVIEW so it is NOT APPROVED
UPDATE candidate_nominations SET status = 'UNDER_REVIEW' WHERE id = '77777777-3333-3333-3333-777777777777';
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    -- Even though TEST_CAND_2 (APPROVED) and TEST_CAND_3 (UNDER_REVIEW) both have 500 votes,
    -- TEST_CAND_3 is not APPROVED and cannot contribute to a tie (leaving v_top_tied_count = 1).
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-2800-0000-0000-000000000006',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted tie resolution where second 500-vote candidate is UNDER_REVIEW (unapproved).',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%genuine tie requires at least 2 eligible APPROVED candidates tied at highest votes (500)%v_top_tied_count = 1%' THEN
        RAISE EXCEPTION 'Scenario 28g failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: Unapproved candidate excluded from highest-vote comparison and tie rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28g: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Unapproved candidate contributed to highest-vote tie comparison!';
  END IF;
END;
$$;
ROLLBACK TO SAVEPOINT s28g_unapproved_candidate_tie;

-- 28h: Three-way tie — accepted (Requirement 2 #2)
SAVEPOINT s28h_three_way_tie;
UPDATE candidate_tallies SET votes = 500, vote_share_percentage = 33.33 WHERE id = 'dddddddd-3333-3333-3333-333333333333'; -- TEST_CAND_2 = 500
UPDATE candidate_tallies SET votes = 500, vote_share_percentage = 33.33 WHERE id = 'dddddddd-4444-4444-4444-444444444444'; -- TEST_CAND_IND = 500
INSERT INTO candidate_tallies (id, session_id, candidate_id, nomination_id, party_id, votes, vote_share_percentage, created_at, updated_at)
VALUES ('dddddddd-5555-5555-5555-555555555555', 'SESS_PC3_ACTIVE', 'TEST_CAND_3', '77777777-3333-3333-3333-777777777777', 'TEST_PARTY_1', 500, 33.34, NOW(), NOW());
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
VALUES (
  'dddddddd-2800-0000-0000-000000000007',
  'SESS_PC3_ACTIVE',
  'WINNER_SELECTED_BY_LOT',
  'TEST_CAND_3',
  'SIMULATED_DRAW_OF_LOTS',
  'Valid simulated draw of lots resolving a genuine three-way tie at 500 votes each.',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  NOW()
);

DO $$
DECLARE
  v_winner VARCHAR(50);
BEGIN
  SELECT selected_winner_id INTO v_winner FROM tie_resolutions WHERE id = 'dddddddd-2800-0000-0000-000000000007';
  IF v_winner != 'TEST_CAND_3' THEN
    RAISE EXCEPTION 'Three-way tie resolution verification failed: expected TEST_CAND_3, got %', v_winner;
  END IF;
  RAISE NOTICE 'SUCCESS: Scenario 28h passed - Genuine three-way tie (v_top_tied_count = 3) accepted and verified.';
END;
$$;
ROLLBACK TO SAVEPOINT s28h_three_way_tie;

-- Now configure SESS_PC3_ACTIVE as a genuine two-candidate tie (TEST_CAND_2 = 500, TEST_CAND_IND = 500) with 2 completed rounds
UPDATE candidate_tallies SET votes = 500, vote_share_percentage = 50.00 WHERE id = 'dddddddd-4444-4444-4444-444444444444';
UPDATE candidate_tallies SET votes = 500, vote_share_percentage = 50.00 WHERE id = 'dddddddd-3333-3333-3333-333333333333';
INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, leading_candidate_id, lead_margin, processed_at, processed_by_admin_id)
VALUES ('c6666666-6666-6666-6666-666666666666', 'SESS_PC3_ACTIVE', 1, 500, 500, 'TEST_CAND_2', 0, NOW(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO counting_rounds (id, session_id, round_number, round_votes, cumulative_votes, leading_candidate_id, lead_margin, processed_at, processed_by_admin_id)
VALUES ('c7777777-7777-7777-7777-777777777777', 'SESS_PC3_ACTIVE', 2, 500, 1000, 'TEST_CAND_2', 0, NOW(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
UPDATE counting_sessions SET status = 'TIED' WHERE id = 'SESS_PC3_ACTIVE';

-- 28i: Attempt TieResolution with selected_winner_id TEST_CAND_1 who lacks an APPROVED nomination in TEST_PC_THIRD (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-2222-3333-4444-555555555555',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_1',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted resolution selecting candidate without approved nomination in constituency.',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%does not hold an APPROVED nomination%' THEN
        RAISE EXCEPTION 'Scenario 28i failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution with unnominated winner rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 28i: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution accepted winner without approved nomination!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 29: TieResolution Administrator Active Status & RBAC Scope Validation
-- ============================================================================
SAVEPOINT s29_tie_resolution_admin_scope;

-- Create inactive admin user and out-of-scope admin user
INSERT INTO users (id, user_type, identifier, password_hash, is_active, failed_login_attempts, created_at, updated_at)
VALUES ('00000002-2222-2222-2222-222222222222', 'ADMIN', 'ECI-INACTIVE-002', 'argon2id$mockhash', TRUE, 0, NOW(), NOW());

INSERT INTO admin_users (id, user_id, officer_code, full_name, designation, role, assigned_state_id, is_active, created_at, updated_at)
VALUES ('bbbbbbbb-2222-2222-2222-222222222222', '00000002-2222-2222-2222-222222222222', 'ECI-INACTIVE-002', 'Inactive Officer', 'Officer', 'SUPER_ADMIN', NULL, FALSE, NOW(), NOW());

INSERT INTO users (id, user_type, identifier, password_hash, is_active, failed_login_attempts, created_at, updated_at)
VALUES ('00000003-3333-3333-3333-333333333333', 'ADMIN', 'ECI-OUTSTATE-003', 'argon2id$mockhash', TRUE, 0, NOW(), NOW());

INSERT INTO admin_users (id, user_id, officer_code, full_name, designation, role, assigned_state_id, is_active, created_at, updated_at)
VALUES ('bbbbbbbb-3333-3333-3333-333333333333', '00000003-3333-3333-3333-333333333333', 'ECI-OUTSTATE-003', 'Other State Admin', 'State CEO', 'STATE_ADMIN', 'TEST_ST_2', TRUE, NOW(), NOW());

-- 29a: Attempt TieResolution with inactive administrator (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-3333-4444-5555-666666666666',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted resolution by an inactive administrator account.',
      'bbbbbbbb-2222-2222-2222-222222222222',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%approving administrator%is inactive%' THEN
        RAISE EXCEPTION 'Scenario 29a failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution by inactive administrator rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 29a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution approved by inactive administrator unexpectedly!';
  END IF;
END;
$$;

-- 29b: Attempt TieResolution with out-of-scope STATE_ADMIN (assigned to TEST_ST_2, constituency in TEST_ST) (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
    VALUES (
      'dddddddd-4444-5555-6666-777777777777',
      'SESS_PC3_ACTIVE',
      'WINNER_SELECTED_BY_LOT',
      'TEST_CAND_2',
      'SIMULATED_DRAW_OF_LOTS',
      'Attempted resolution by an out-of-scope state administrator.',
      'bbbbbbbb-3333-3333-3333-333333333333',
      NOW()
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%assigned state (TEST_ST_2) does not match constituency state (TEST_ST)%' THEN
        RAISE EXCEPTION 'Scenario 29b failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: TieResolution by out-of-scope administrator rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 29b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: TieResolution approved by out-of-scope administrator unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 30: TieResolution DELETE Rejection & CountingSession Deletion Restriction
-- ============================================================================
SAVEPOINT s30_tie_deletion_restriction;

-- 30a: Attempt to DELETE immutable tie_resolutions row dddddddd-dddd-dddd-dddd-dddddddddddd (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    DELETE FROM tie_resolutions WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%immutable audit evidence%' THEN
        RAISE EXCEPTION 'Scenario 30a failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: Deletion of tie_resolutions blocked by immutability trigger [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 30a: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Immutable tie_resolutions record deleted unexpectedly!';
  END IF;
END;
$$;

-- 30b: Attempt to DELETE CountingSession SESS_TIED_1 that has immutable tie_resolutions evidence (Must Fail)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    DELETE FROM counting_sessions WHERE id = 'SESS_TIED_1';
  EXCEPTION
    WHEN SQLSTATE 'P0001' OR foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%immutable tie_resolutions evidence exists%' AND v_err_msg NOT LIKE '%fk_tie_res_session%' THEN
        RAISE EXCEPTION 'Scenario 30b failed for wrong reason: %', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: CountingSession deletion with tie-resolution evidence rejected [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 30b: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: CountingSession with tie-resolution evidence deleted unexpectedly!';
  END IF;
END;
$$;

-- ============================================================================
-- SCENARIO 31: Complete Tied Session Review & Publication Workflow
--              (TIED -> RESULT_READY_FOR_REVIEW -> PUBLISHED)
-- ============================================================================
SAVEPOINT s31_publication_resolved_winner_only;

-- Step 1: Verify SESS_PC3_ACTIVE is a valid tied session in TIED status (TEST_CAND_2 = 500, TEST_CAND_IND = 500, rounds = 2/2)
DO $$
DECLARE
  v_stat "ResultStatus";
  v_pub BOOLEAN;
  v_rounds INT;
  v_total INT;
BEGIN
  SELECT status, is_published, current_round, total_counted_votes
  INTO v_stat, v_pub, v_rounds, v_total
  FROM counting_sessions
  WHERE id = 'SESS_PC3_ACTIVE';

  IF v_stat != 'TIED' OR v_pub != FALSE OR v_rounds != 2 OR v_total != 1000 THEN
    RAISE EXCEPTION 'Scenario 31 Step 1 precondition failed: status=%, is_published=%, rounds=%, total=%',
      v_stat, v_pub, v_rounds, v_total;
  END IF;
END;
$$;

-- Step 2: Insert valid tie-resolution evidence for SESS_PC3_ACTIVE (Genuine two-candidate tie accepted [Requirement 2 #1])
INSERT INTO tie_resolutions (id, session_id, decision, selected_winner_id, resolution_method, justification_note, approved_by_admin_id, resolved_at)
VALUES (
  'dddddddd-3131-3131-3131-313131313131',
  'SESS_PC3_ACTIVE',
  'WINNER_SELECTED_BY_LOT',
  'TEST_CAND_2',
  'SIMULATED_DRAW_OF_LOTS',
  'Simulated educational draw of lots resolving 500-500 tie in SESS_PC3_ACTIVE in favor of TEST_CAND_2.',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  NOW()
);

-- Step 3: Transition SESS_PC3_ACTIVE from TIED -> RESULT_READY_FOR_REVIEW with the resolved winner (TEST_CAND_2)
UPDATE counting_sessions
SET status = 'RESULT_READY_FOR_REVIEW',
    winner_candidate_id = 'TEST_CAND_2',
    runner_up_candidate_id = 'TEST_CAND_IND',
    victory_margin = 0
WHERE id = 'SESS_PC3_ACTIVE';

-- Step 4: Attempt publication (RESULT_READY_FOR_REVIEW -> PUBLISHED) with a different winner (TEST_CAND_IND)
--         and verify rejection SPECIFICALLY because of the winner mismatch (not a state-transition error!)
DO $$
DECLARE
  v_caught_expected_error BOOLEAN := FALSE;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
BEGIN
  BEGIN
    UPDATE counting_sessions
    SET status = 'PUBLISHED',
        is_published = TRUE,
        winner_candidate_id = 'TEST_CAND_IND',
        runner_up_candidate_id = 'TEST_CAND_2',
        published_by_admin_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        published_at = NOW()
    WHERE id = 'SESS_PC3_ACTIVE';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
      IF v_err_msg NOT LIKE '%does not match resolved winner (TEST_CAND_2) in tie_resolutions%' THEN
        RAISE EXCEPTION 'Scenario 31 Step 4 failed for wrong reason (expected winner mismatch error, got: %)', v_err_msg;
      END IF;
      v_caught_expected_error := TRUE;
      RAISE NOTICE 'SUCCESS: Publication from RESULT_READY_FOR_REVIEW with non-resolved winner rejected specifically for winner mismatch [%]: %', v_err_sqlstate, v_err_msg;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'UNEXPECTED ERROR in Scenario 31 Step 4: Caught % (%)', SQLERRM, SQLSTATE;
  END;

  IF NOT v_caught_expected_error THEN
    RAISE EXCEPTION 'ASSERTION FAILED: Tied session published with winner different from TieResolution!';
  END IF;
END;
$$;

-- Step 5: Verify that SESS_PC3_ACTIVE remains in RESULT_READY_FOR_REVIEW with is_published = FALSE after the failed attempt
DO $$
DECLARE
  v_stat "ResultStatus";
  v_pub BOOLEAN;
  v_win VARCHAR(50);
  v_pub_admin UUID;
  v_pub_at TIMESTAMPTZ;
BEGIN
  SELECT status, is_published, winner_candidate_id, published_by_admin_id, published_at
  INTO v_stat, v_pub, v_win, v_pub_admin, v_pub_at
  FROM counting_sessions
  WHERE id = 'SESS_PC3_ACTIVE';

  IF v_stat != 'RESULT_READY_FOR_REVIEW' OR v_pub != FALSE OR v_win != 'TEST_CAND_2' OR v_pub_admin IS NOT NULL OR v_pub_at IS NOT NULL THEN
    RAISE EXCEPTION 'Scenario 31 Step 5 failed: session did not remain in RESULT_READY_FOR_REVIEW (status=%, is_published=%, winner=%)',
      v_stat, v_pub, v_win;
  END IF;
  RAISE NOTICE 'SUCCESS: Scenario 31 Step 5 verified - Session remained in RESULT_READY_FOR_REVIEW after rejected publication attempt.';
END;
$$;

-- Step 6: Publish SESS_PC3_ACTIVE (RESULT_READY_FOR_REVIEW -> PUBLISHED) using the exact resolved winner (TEST_CAND_2)
UPDATE counting_sessions
SET status = 'PUBLISHED',
    is_published = TRUE,
    winner_candidate_id = 'TEST_CAND_2',
    runner_up_candidate_id = 'TEST_CAND_IND',
    published_by_admin_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    published_at = NOW()
WHERE id = 'SESS_PC3_ACTIVE';

-- Steps 7, 8 & 9: Verify status = PUBLISHED, is_published = TRUE, published_by_admin_id, and published_at
DO $$
DECLARE
  v_stat "ResultStatus";
  v_pub BOOLEAN;
  v_win VARCHAR(50);
  v_pub_admin UUID;
  v_pub_at TIMESTAMPTZ;
BEGIN
  SELECT status, is_published, winner_candidate_id, published_by_admin_id, published_at
  INTO v_stat, v_pub, v_win, v_pub_admin, v_pub_at
  FROM counting_sessions
  WHERE id = 'SESS_PC3_ACTIVE';

  IF v_stat != 'PUBLISHED' THEN
    RAISE EXCEPTION 'Scenario 31 Step 7 failed: expected status = PUBLISHED, got %', v_stat;
  END IF;

  IF v_pub != TRUE THEN
    RAISE EXCEPTION 'Scenario 31 Step 8 failed: expected is_published = TRUE, got %', v_pub;
  END IF;

  IF v_win != 'TEST_CAND_2' THEN
    RAISE EXCEPTION 'Scenario 31 winner check failed: expected TEST_CAND_2, got %', v_win;
  END IF;

  IF v_pub_admin IS DISTINCT FROM 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid OR v_pub_at IS NULL THEN
    RAISE EXCEPTION 'Scenario 31 Step 9 failed: expected publisher ID and timestamp, got admin=%, at=%', v_pub_admin, v_pub_at;
  END IF;

  RAISE NOTICE 'SUCCESS: Scenario 31 passed - Full TIED -> RESULT_READY_FOR_REVIEW -> PUBLISHED workflow verified (status=%, is_published=%, winner=%, admin=%, published_at=%).',
    v_stat, v_pub, v_win, v_pub_admin, v_pub_at;
END;
$$;

ROLLBACK;

-- All scenarios passed successfully
SELECT 'OVS Phase 8.1.6 PostgreSQL Integration Validation Suite: ALL 31 SCENARIOS (INCLUDING ALL 23 BASE SCENARIOS) PASSED' AS verdict;

