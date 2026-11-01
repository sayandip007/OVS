# OVS Phase 8.1.5 — Final SQL Trigger Corrections & Database Runtime Readiness Report

**Date**: 2026-11-01  
**Phase**: Phase 8.1.5 (Final SQL Trigger Corrections & Database Runtime Readiness)  
**Target Architecture**: PostgreSQL 16+ & Prisma ORM (`docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma`, `docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql`)  
**Final Verdict**: **READY FOR PHASE 8.2** *(with honest disclosure that PostgreSQL runtime execution requires a live PostgreSQL 16+ server outside this container environment)*

---

## 1. Repository Audit Findings (Defects Identified & Verified)

Before making any modifications, a full audit of `docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma`, `docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql`, `tests/postgresql-validation.sql`, `tests/architectureConsistency.test.mjs`, and `PHASE_8_1_4_FINAL_AUDIT_REPORT.md` was conducted. The following defects were verified and resolved:

| Defect ID | Severity | Location | Finding | Resolution Status |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-8.1.5-01** | **CRITICAL** | `CUSTOM_DATABASE_INTEGRITY.sql` (`verify_counting_round_progression`), `DATABASE_DESIGN.md`, `ARCHITECTURE_DECISIONS.md` | `verify_counting_round_progression()` referenced `IF NEW.lead_candidate_id IS NOT NULL OR NEW.leading_candidate_id IS NOT NULL`. In PostgreSQL PL/pgSQL, referencing `NEW.lead_candidate_id` on `counting_rounds` (where only `leading_candidate_id` exists) throws a runtime error (`record "new" has no field "lead_candidate_id"`). | **FIXED** — Removed all `lead_candidate_id` references across SQL, tests, and documentation; added automated schema-to-trigger `NEW.<col>` / `OLD.<col>` verification in `tests/architectureConsistency.test.mjs`. |
| **DEF-8.1.5-02** | **HIGH** | `CUSTOM_DATABASE_INTEGRITY.sql` (`verify_candidate_tally_nomination`) | `verify_candidate_tally_nomination()` looked up `v_candidate_party_id` from `candidates.party_id` and allowed `NEW.party_id != v_nom_party_id AND NEW.party_id != v_candidate_party_id`. If a candidate changed global party in `candidates`, a tally with the new party could pass even though it contradicted the historical `candidate_nominations.party_id`. Furthermore, if `v_nom_party_id` was `NULL` (independent candidate) and `NEW.party_id` was non-NULL, the `v_nom_party_id IS NOT NULL` guard skipped rejecting the invalid party. | **FIXED** — Removed `v_candidate_party_id` fallback completely; enforced `NEW.party_id IS NOT DISTINCT FROM v_nom_party_id`; added composite FK `fk_tally_nomination_candidate_party`; blocked mutating `party_id` on `candidate_nominations` when dependent tallies exist. |
| **DEF-8.1.5-03** | **HIGH** | `CUSTOM_DATABASE_INTEGRITY.sql` (`verify_candidate_tally_nomination`, `protect_and_reconcile_candidate_tallies`) | Updating `candidate_tallies.session_id` to another session was not blocked. Because `auto_reconcile_session_votes_on_tally_change()` only recomputed `NEW.session_id` on `UPDATE`, moving a tally across sessions left `OLD.session_id` with stale `total_counted_votes`. | **FIXED** — Explicitly rejected any `UPDATE` on `candidate_tallies` where `OLD.session_id IS DISTINCT FROM NEW.session_id` or `OLD.candidate_id IS DISTINCT FROM NEW.candidate_id`. |
| **DEF-8.1.5-04** | **HIGH** | `CUSTOM_DATABASE_INTEGRITY.sql` (`tie_resolutions`) | `tie_resolutions` lacked a `BEFORE INSERT` validation trigger. Any row could be inserted even if the session was not `TIED`, if `selected_winner_id` was not tied for the top vote total (`MAX(votes)`), or if `approved_by_admin_id` was inactive, a `READ_ONLY_AUDITOR`, or outside state/election scope. Additionally, `verify_counting_session_publication()` only checked `winner_candidate_id = tie_resolutions.selected_winner_id` on `TIED -> RESULT_READY_FOR_REVIEW`, not when transitioning to `PUBLISHED`. | **FIXED** — Added `verify_tie_resolution_insert()` (`trg_verify_tie_resolution_insert`) enforcing all 10 rules, and enforced `winner_candidate_id = tie_resolutions.selected_winner_id` in both `RESULT_READY_FOR_REVIEW` and `PUBLISHED`. |
| **DEF-8.1.5-05** | **MEDIUM** | `PRISMA_SCHEMA_DRAFT.prisma`, `CUSTOM_DATABASE_INTEGRITY.sql` | `TieResolution.session` used `onDelete: Cascade` (`ON DELETE CASCADE`), contradicting `protect_tie_resolution_immutability()` and allowing session deletion to attempt cascading deletion of immutable audit evidence. | **FIXED** — Changed `TieResolution.session` to `onDelete: Restrict` in Prisma and `ON DELETE RESTRICT ON UPDATE RESTRICT` in SQL, plus added `protect_counting_session_deletion()`. |

---

## 2. Exact SQL, Prisma & Trigger Changes Made

### 2.1 `docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma`
1. **`CandidateNomination`**:
   - Added `@@unique([id, candidateId, partyId])` (`uq_nomination_id_candidate_party`) to support composite foreign key verification from `CandidateTally`.
2. **`CandidateTally`**:
   - Changed `candidate` relation from `onDelete: Cascade` to `onDelete: Restrict` to prevent cascading deletion of historical candidate tallies.
3. **`TieResolution`**:
   - Changed `session` relation from `onDelete: Cascade` to `onDelete: Restrict`.
   - Added `@@index([selectedWinnerId])` and `@@index([approvedByAdminId])`.

### 2.2 `docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql`
1. **Composite Historical Nomination-Party Foreign Key**:
   - Added `uq_nomination_id_candidate_party UNIQUE (id, candidate_id, party_id)` on `candidate_nominations`.
   - Added `fk_tally_nomination_candidate_party FOREIGN KEY (nomination_id, candidate_id, party_id) REFERENCES candidate_nominations(id, candidate_id, party_id) MATCH SIMPLE ON DELETE RESTRICT ON UPDATE RESTRICT` on `candidate_tallies`.
2. **`tie_resolutions` Table DDL & Constraints**:
   - Changed `fk_tie_res_session` to `FOREIGN KEY (session_id) REFERENCES counting_sessions(id) ON DELETE RESTRICT ON UPDATE RESTRICT`.
   - Added `chk_tie_resolution_valid_fields` enforcing non-empty `decision`, `resolution_method`, and `justification_note`.
3. **`verify_counting_round_progression()`**:
   - Removed nonexistent `NEW.lead_candidate_id` check; validates exclusively `IF NEW.leading_candidate_id IS NOT NULL THEN`.
4. **`verify_candidate_tally_nomination()`**:
   - Rejects `UPDATE` if `OLD.session_id IS DISTINCT FROM NEW.session_id` or `OLD.candidate_id IS DISTINCT FROM NEW.candidate_id`.
   - Locks parent `counting_sessions` row `FOR UPDATE` and `candidate_nominations` row `FOR SHARE`.
   - Removes `v_candidate_party_id` lookup and enforces `NEW.party_id IS NOT DISTINCT FROM v_nom_party_id`.
5. **`protect_nomination_lifecycle()`**:
   - Blocks changing `party_id` (`OLD.party_id IS DISTINCT FROM NEW.party_id`) on `candidate_nominations` when dependent `candidate_tallies` exist.
6. **`verify_tie_resolution_insert()` & `trg_verify_tie_resolution_insert`**:
   - Dedicated `BEFORE INSERT ON tie_resolutions` trigger validating all 10 tie-resolution invariants.
7. **`verify_counting_session_publication()`**:
   - Enforces `winner_candidate_id = tie_resolutions.selected_winner_id` whenever a tie resolution exists for the session in both `RESULT_READY_FOR_REVIEW` and `PUBLISHED` states.
8. **`protect_counting_session_deletion()` & `trg_protect_counting_session_deletion`**:
   - `BEFORE DELETE ON counting_sessions` trigger blocking deletion of any session progressed beyond `DRAFT` or having `tie_resolutions` or `result_correction_history` rows.

---

## 3. Exact Simulated Tie-Resolution Validation Rules

The tie-resolution workflow is documented and enforced as a **simulated educational governance workflow** (inspired by Returning Officer draw-of-lots procedures under Section 102 of the *Representation of the People Act, 1951*, without claiming legally authoritative statutory certification).

`verify_tie_resolution_insert()` (`BEFORE INSERT ON tie_resolutions`) enforces all 10 mandatory rules:

1. **Counting Session Exists & Locked**: `NEW.session_id` must exist in `counting_sessions` (locked `FOR UPDATE`).
2. **Session Status Must Be `TIED`**: `v_session.status` must be `'TIED'`; inserting a tie resolution for `DRAFT`, `COUNTING_IN_PROGRESS`, `COUNTING_COMPLETED`, `RESULT_READY_FOR_REVIEW`, or `PUBLISHED` raises `P0001`.
3. **Single Tie Resolution Per Session**: Enforced by both `UNIQUE (session_id)` and trigger check (`COUNT(*) FROM tie_resolutions WHERE session_id = NEW.session_id`).
4. **Controlled Decision Value**: `NEW.decision` must be `'SIMULATED_TIE_BROKEN_DRAW_OF_LOTS'` or `'WINNER_SELECTED_BY_LOT'`.
5. **Controlled Resolution Method**: `NEW.resolution_method` must be `'SIMULATED_DRAW_OF_LOTS'`, `'DRAW_OF_LOTS'`, or `'DRAW_OF_LOTS_RO_SECTION_102_RPA_102_1951'` / `'DRAW_OF_LOTS_RO_SECTION_102_RPA_1951'`.
6. **Non-Empty Justification Note**: `NEW.justification_note` must be non-null and non-blank (` LENGTH(BTRIM(NEW.justification_note)) > 0`).
7. **Winner Holds Approved Nomination in Session Constituency**: `NEW.selected_winner_id` must have an `APPROVED` nomination in `candidate_nominations` matching `v_session.election_id`, `v_session.constituency_type`, and the exact `parliamentary_constituency_id` or `assembly_constituency_id` (`FOR SHARE`).
8. **Winner Is Tied for Highest Vote Count**: `NEW.selected_winner_id` must exist in `candidate_tallies` for `NEW.session_id`, `MAX(votes)` in the session must be `> 0`, `v_winner_votes` must equal `MAX(votes)`, and at least 2 candidates (`v_top_tied_count >= 2`) must have `votes = MAX(votes)`.
9. **Approving Admin Exists, Is Active & Holds Authorized Role**: `NEW.approved_by_admin_id` must exist in `admin_users` with `admin_users.is_active = TRUE` and linked `users.is_active = TRUE`, and hold role `SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, or `ELECTION_OFFICER` (`READ_ONLY_AUDITOR` is rejected).
10. **Approving Admin State & Election Scope**:
    - If `v_admin_role = 'STATE_ADMIN'`, `v_admin_state_id` must equal the constituency's `state_id`.
    - If `v_admin_role = 'ELECTION_OFFICER'`, an assignment row must exist in `admin_election_scopes` for `(admin_user_id, election_id)` (and if `assigned_state_id` is set, it must match the constituency state).

---

## 4. Exact Historical Party-Integrity Rules

1. **Nomination Is the Authoritative Historical Party Source**: `CandidateNomination.party_id` records the political party (or `NULL` for an independent candidate) under which the candidate contested that specific election and constituency.
2. **Zero Fallback to Global `candidates.party_id`**: `verify_candidate_tally_nomination()` does not query `candidates.party_id`. Updating `candidates.party_id` for a subsequent election never affects or validates historical `candidate_nominations` or `candidate_tallies`.
3. **Null-Safe Exact Equality (`IS NOT DISTINCT FROM`)**:
   - When `v_nom_party_id IS NOT NULL` and `NEW.party_id IS NULL` on `INSERT`, `NEW.party_id` is auto-populated to `v_nom_party_id`.
   - Thereafter, `IF NEW.party_id IS DISTINCT FROM v_nom_party_id` raises `P0001`.
   - For independent nominations (`v_nom_party_id IS NULL`), `NEW.party_id` must be `NULL`; supplying any non-null `party_id` raises `P0001`.
4. **Composite Foreign Key & Lifecycle Lock**:
   - `fk_tally_nomination_candidate_party` binds `(nomination_id, candidate_id, party_id)` to `candidate_nominations(id, candidate_id, party_id)`.
   - `protect_nomination_lifecycle()` blocks any `UPDATE` to `candidate_nominations.party_id` once dependent `candidate_tallies` exist.

---

## 5. Exact Session Ownership Immutability Rules

1. **`CandidateTally.session_id` Immutability**: Both `verify_candidate_tally_nomination()` (`BEFORE UPDATE`) and `protect_and_reconcile_candidate_tallies()` (`BEFORE UPDATE`) check `IF OLD.session_id IS DISTINCT FROM NEW.session_id` and immediately raise `P0001`.
2. **`CandidateTally.candidate_id` Immutability**: Both triggers also check `IF OLD.candidate_id IS DISTINCT FROM NEW.candidate_id` and raise `P0001`.
3. **Source Session Total Protection**: Because a tally row can never be moved to another `session_id` via `UPDATE`, `auto_reconcile_session_votes_on_tally_change()` can never leave a source session with stale `total_counted_votes`.

---

## 6. Transaction & Lock-Order Guarantees

All database triggers and transactional operations enforce a deterministic top-down lock acquisition order to prevent deadlocks:

1. **Level 1 — Advisory Lock (Nomination Ceiling)**: `pg_advisory_xact_lock(hashtext('candidate_nomination_limit:' || candidate_id || ':' || election_id))` in `verify_candidate_nomination_compatibility()`.
2. **Level 2 — Parent `counting_sessions` Row Lock (`FOR UPDATE`)**: Acquired first in `verify_candidate_tally_nomination()`, `protect_and_reconcile_candidate_tallies()`, `auto_reconcile_session_votes_on_tally_change()`, `verify_counting_round_progression()`, `protect_counting_round_deletion()`, `synchronize_session_current_round()`, and `verify_tie_resolution_insert()`.
3. **Level 3 — Referenced `candidate_nominations` Row Lock (`FOR SHARE`)**: Acquired after the parent `counting_sessions` lock when verifying candidate eligibility.
4. **Level 4 — Child Counting Tables (`counting_rounds`, `candidate_tallies`, `tie_resolutions`, `result_correction_history`)**: Queried or mutated only after holding the parent `counting_sessions` lock.

---

## 7. Exact Test Results

### 7.1 Automated Node.js Test Suite (`npm test`)
- **Total Tests**: **83 tests across 2 files (`tests/electionArchitecture.test.mjs` + `tests/architectureConsistency.test.mjs`)**
  - `tests/electionArchitecture.test.mjs`: **37 / 37 passed** (Frontend domain, timeline, privacy, and counting logic preserved).
  - `tests/architectureConsistency.test.mjs`: **46 / 46 passed** (Static Prisma/SQL/Trigger/Documentation architecture verification, including Suite 5 Tests `8.1.5.1`–`8.1.5.6` with full schema-to-trigger `NEW.<col>` / `OLD.<col>` verification).
- **TypeScript Typecheck (`npm run typecheck`)**: **0 errors**
- **ESLint (`npm run lint`)**: **0 errors**
- **Production Build (`npm run build`)**: **Succeeded**

### 7.2 PostgreSQL Integration Test Script (`tests/postgresql-validation.sql`)
- Contains **31 comprehensive scenarios** (Scenarios 1–23 from Phase 8.1.4 plus Scenarios 24–31 added in Phase 8.1.5 covering all 17 required Phase 8.1.5 positive and negative checks using strict `v_caught_expected_error` subtransaction assertions).

---

## 8. Honest PostgreSQL Runtime Execution Status Disclosure

- **Container Environment Inspection**: Checking `which psql pg_ctl initdb docker` confirmed that **neither PostgreSQL server/client binaries (`psql`, `pg_ctl`, `initdb`) nor `docker` are installed in this container environment**.
- **Distinction Between Static Verification and Live PostgreSQL Runtime**:
  - **Executed & Verified in This Environment**: Static schema-to-SQL column mapping verification, trigger `NEW.<col>` / `OLD.<col>` field existence verification against `PRISMA_SCHEMA_DRAFT.prisma`, trigger order and constraint presence checks, and all 83 Node.js tests (`npm test`).
  - **Not Executed in Live PostgreSQL Runtime in This Environment**: `docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql` and `tests/postgresql-validation.sql` have **not** been executed against a live PostgreSQL 16+ process inside this container. They must be run in CI or a developer machine with PostgreSQL 16+ installed via:
    ```bash
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql
    ```

---

## 9. Accurate Model & Enum Inventory

### 9.1 Prisma Models (25 Models)
1. `State` (`states`)
2. `District` (`districts`)
3. `ParliamentaryConstituency` (`parliamentary_constituencies`)
4. `AssemblyConstituency` (`assembly_constituencies`)
5. `User` (`users`)
6. `VoterProfile` (`voter_profiles`)
7. `UserSession` (`user_sessions`)
8. `AuthChallenge` (`auth_challenges`)
9. `Election` (`elections`)
10. `ElectionConstituency` (`election_constituencies`)
11. `ElectionLifecycleHistory` (`election_lifecycle_history`)
12. `PoliticalParty` (`political_parties`)
13. `Candidate` (`candidates`)
14. `CandidateNomination` (`candidate_nominations`)
15. `AdminUser` (`admin_users`)
16. `AdminElectionScope` (`admin_election_scopes`)
17. `AdminActionLog` (`admin_action_logs`)
18. `DemoParticipation` (`demo_participations`)
19. `CountingSession` (`counting_sessions`)
20. `CountingRound` (`counting_rounds`)
21. `CandidateTally` (`candidate_tallies`)
22. `ResultCorrectionHistory` (`result_correction_history`)
23. `Announcement` (`announcements`)
24. `VoterNotification` (`voter_notifications`)
25. `TieResolution` (`tie_resolutions`)

### 9.2 Prisma Enums (17 Enums — Verified Directly Against `PRISMA_SCHEMA_DRAFT.prisma`)
1. `JurisdictionType`
2. `MetadataSource`
3. `ReservationType`
4. `UserType`
5. `ElectionType`
6. `ConstituencyType`
7. `ElectionStatus`
8. `ParticipationStatus`
9. `CandidateNominationStatus`
10. `PartyType`
11. `PartyStatus`
12. `AdminRole`
13. `ResultStatus`
14. `AnnouncementCategory`
15. `AnnouncementAudience`
16. `AnnouncementStatus`
17. `NotificationType`


---

## 10. Remaining Risks & Limitations

1. **Live PostgreSQL CI Execution**: While static AST/regex analysis in `tests/architectureConsistency.test.mjs` verifies every table, column, and `NEW.<field>` / `OLD.<field>` reference across all 16 trigger functions against `PRISMA_SCHEMA_DRAFT.prisma`, the live execution of `tests/postgresql-validation.sql` must be gated in GitHub Actions CI with a `postgres:16-alpine` service container during Phase 8.2.
2. **Educational Simulation Scope**: All ballot participation, counting rounds, and tie-resolution workflows represent an educational governance simulation and do not constitute legally certified statutory election administration.

---

## 11. Final Readiness Verdict

**Verdict**: **READY FOR PHASE 8.2**
