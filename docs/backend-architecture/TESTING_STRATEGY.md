# OVS Backend Testing Strategy & Quality Assurance Framework (Phase 8.1.2 Hardened)

## 1. Testing Philosophy & Test Pyramid

The OVS testing architecture guarantees that all electoral domain rules, constitutional geography hierarchies, RBAC permissions, and critical ballot secrecy invariants are verified automatically across multiple test tiers:

```text
               ▲
              / \
             /   \      Playwright Browser E2E Tests (12 Suites)
            / E2E \     - Full voter ballot workflows & dual elections
           /-------\    - Admin scrutiny, monitoring & counting
          /  API    \   Supertest Integration Tests (REST Endpoints)
         / Integrat. \  - Auth, RBAC, Scoping, Participation, Publication (RFC 9457)
        /-------------\ Database Constraint, Trigger & Repository Tests
       /  Repository   \- Foreign key cascades, partial unique indexes, triggers, CHECKs
      /-----------------\
     /   Unit & Domain   \ Pure Service Tests (Chronology, Standings, Ties, Architecture)
    /_____________________\ Zero external dependencies, fast execution (<1s)
```

---

## 2. Testing Layers & Tooling

| Tier | Tooling | Target Scope | Execution Time |
| :--- | :--- | :--- | :--- |
| **Unit & Domain Logic** | Node.js Test Runner (`node:test`) | Election lifecycle state machine, 8-milestone schedule chronology validator, tie calculation, CSV sanitization, architectural consistency (`tests/architectureConsistency.test.mjs`). | < 500 ms |
| **Database & Repositories** | PostgreSQL Test Container + Prisma Client | Explicit `@map` column mappings, composite foreign keys `(district_id, state_id)`, `(candidate_id, party_id)`, partial unique indexes, triggers, check constraints in `CUSTOM_DATABASE_INTEGRITY.sql`. | ~ 2–3 s |
| **API Integration** | Supertest + Express App | Authentication flow, OTP verification, cookie setting, CSRF validation, RBAC route guards, Zod validation filters, RFC 9457 Problem Details formatting. | ~ 4–5 s |
| **E2E Browser Regressions** | Playwright (`@playwright/test`) | Real Chromium browser journeys across Public Portal, Voter Portal, and ECI Admin. | ~ 45–60 s |

---

## 3. Mandatory Invariant Test Suites

### 3.1 Suite 1: Independent Simultaneous Election Administration
- **Scenario A**: Voter in West Bengal (`WBX1234567`) participates in Lok Sabha (`LS-2029`).
  - *Assertion*: `GET /api/v1/voters/me/elections` returns `LS-2029` as `VOTED`, while simultaneous election `WB-ASSEMBLY-2029` remains strictly `PENDING`.
- **Scenario B**: Voter completes `WB-ASSEMBLY-2029`.
  - *Assertion*: Both elections marked `VOTED` (`2/2 Completed`). State Assembly election in Delhi (`DL-ASSEMBLY-2029`) remains `NOT_ELIGIBLE`.

### 3.2 Suite 2: Strict Ballot Privacy & Zero Choice Persistence
- **Payload Inspection**: `POST /api/v1/demo-participation` submitted with `candidateId: "CAND-01"`.
  - *Assertion*: Request rejected with `400 Bad Request` (`PROHIBITED_CHOICE_FIELD`).
- **Database Inspection**: Inspect `demo_participations` table after successful participation.
  - *Assertion*: Zero candidate ID, party ID, or choice reference exists.
  - *Assertion*: `candidate_tallies` table for the constituency remains completely unchanged.

### 3.3 Suite 3: Cross-State & Admin Scope Restrictions
- **Scenario A (`STATE_ADMIN`)**: Officer assigned to `WB` (`ECI-WB-003`) attempts `PATCH /api/v1/admin/elections/MH-ASSEMBLY-2029`.
  - *Assertion*: Rejected with `403 Forbidden` (`SCOPE_VIOLATION: Officer restricted to state WB`).
- **Scenario B (`ELECTION_OFFICER`)**: Officer attempts to advance rounds on an election not assigned in `admin_election_scopes`.
  - *Assertion*: Rejected with `403 Forbidden` (`SCOPE_VIOLATION: Election not assigned to officer`).
- **Scenario C (`READ_ONLY_AUDITOR`)**: Auditor (`ECI-AUD-005`) attempts `POST /api/v1/admin/counting-sessions/.../rounds`.
  - *Assertion*: Rejected with `403 Forbidden` (`READ_ONLY_AUDITOR has view-only access`).

### 3.4 Suite 4: Election Lifecycle & Timeline Consistency
- **Premature Polling Guard**: Attempt to transition an election to `POLLING_ACTIVE` before its `pollingStartDate`.
  - *Assertion*: Rejected with `400 Bad Request` unless `demoLifecycleOverride: true`.
- **Incomplete Round Publication Guard**: Attempt to publish constituency result (`POST /api/v1/admin/results/:id/publish`) when `currentRound < totalConfiguredRounds`.
  - *Assertion*: Rejected with `400 Bad Request` (`COUNTING_INCOMPLETE`).
- **Tie Resolution Guard**: Attempt to declare election results while an unresolved tie (`TIED`) exists.
  - *Assertion*: Rejected with `400 Bad Request` (`TIE_REQUIRES_RESOLUTION`).

### 3.5 Suite 5: Duplicate Demo Participation Prevention
- **Scenario**: Voter submits `POST /api/v1/demo-participation` twice for the same election ID.
  - *Assertion 1*: First submission returns `201 Created`.
  - *Assertion 2*: Second submission returns `409 Conflict` (`ALREADY_PARTICIPATED`).
  - *Assertion 3*: Relational database rejects duplicate entry via `UNIQUE (voter_id, election_id)` constraint.

### 3.6 Suite 6: Database Integrity & Composite Constraint Verification
- **Geographic Hierarchy**: Attempt to insert an `AssemblyConstituency` with a `district_id` in state `WB` but `state_id` set to `MH`.
  - *Assertion*: Rejected by composite foreign key `FOREIGN KEY (district_id, state_id) REFERENCES districts(id, state_id)`.
- **Constituency Type Exclusivity**: Attempt to insert an `ElectionConstituency` with both `parliamentary_constituency_id` and `assembly_constituency_id` populated.
  - *Assertion*: Rejected by PostgreSQL `CHECK` constraint.
- **Candidate-Party Consistency**: Attempt to record votes in `candidate_tallies` for a candidate under a party they do not belong to.
  - *Assertion*: Rejected by composite foreign key `FOREIGN KEY (candidate_id, party_id) REFERENCES candidates(id, party_id)`.

### 3.7 Suite 7: Candidate Nomination & Counting Tally Invariants (Phase 8.1.2)
- **Approved Nomination Invariant**: Attempt to insert a tally in `candidate_tallies` for a candidate without an `APPROVED` nomination in that counting session's election/constituency.
  - *Assertion*: Rejected by trigger `trg_verify_candidate_tally_nomination`.
- **Winner Validation**: Attempt to set `winner_candidate_id` to a candidate not holding an `APPROVED` nomination in that session.
  - *Assertion*: Rejected by trigger `trg_verify_counting_session_candidates`.
- **NOTA Separation**: Attempt to submit a tally record with `candidate_id = 'NOTA'`.
  - *Assertion*: Rejected; NOTA must use `counting_sessions.nota_votes`.

### 3.8 Suite 8: Result Publication Hardening (Phase 8.1.2)
- **Direct INSERT Protection**: Attempt to insert a new counting session with `is_published = true` or `status = 'PUBLISHED'`.
  - *Assertion*: Rejected by trigger `trg_verify_counting_session_publication`. Must start in `DRAFT`.
- **Review Stage Gate**: Attempt to update `is_published = true` directly from `DRAFT` or `COUNTING_COMPLETED`.
  - *Assertion*: Rejected; status must transition through `RESULT_READY_FOR_REVIEW`.
- **Audit Logging**: Attempt to transition to `CORRECTED` without an entry in `result_correction_history`.
  - *Assertion*: Rejected by trigger.

### 3.9 Suite 9: Counting Reconciliation & Mathematical Progression (Phase 8.1.2)
- **Sum Equality**: Attempt to complete counting where $\text{total\_counted\_votes} \ne \sum(\text{candidate votes}) + \text{nota} + \text{rejected}$.
  - *Assertion*: Rejected by trigger `trg_reconcile_counting_session_votes`.
- **Round Delta & Monotonicity**: Attempt to record round 2 where cumulative votes decrease.
  - *Assertion*: Rejected by trigger `trg_verify_counting_round_progression`.

### 3.10 Suite 10: PostgreSQL Integrity & Transaction-Safety Suite (Phase 8.1.3)
- **ElectionConstituency Membership**: Attempt to nominate a candidate or create a counting session in an unmapped constituency.
  - *Assertion*: Aborted by `trg_verify_candidate_nomination_compatibility` or `trg_verify_counting_session_compatibility`.
- **ElectionConstituency Mutation Guard**: Attempt to delete or alter constituency mappings with dependent nominations or sessions.
  - *Assertion*: Rejected by `trg_prevent_election_constituency_mutation`.
- **Candidate Nomination Lifecycle & Tally Protection**: Attempt to delete or invalidate a nomination with active tallies.
  - *Assertion*: Rejected by `trg_protect_nomination_lifecycle` and foreign key `fk_tally_nomination`.
- **Bidirectional Vote Reconciliation**: Attempt to modify candidate tallies on completed counting sessions, or record incorrect totals.
  - *Assertion*: Rejected by `trg_protect_and_reconcile_candidate_tallies`. Zero-vote cases strictly reconciled without bypass.
- **Publication Equivalence & Physical Round Completeness**: Direct SQL insertion or publication without all physical round records.
  - *Assertion*: Rejected by `chk_counting_session_publication_equivalence` and `trg_verify_counting_session_publication`.
- **Advisory Transaction Locking**: Concurrent nomination insertions for the same candidate and election.
  - *Assertion*: Serialized via `pg_advisory_xact_lock(hashtext(...))`.
- **Round Deletion & Immutability**: Attempt to delete earlier rounds out of reverse order or alter earlier round totals.
  - *Assertion*: Rejected by `trg_protect_counting_round_deletion` and `trg_verify_counting_round_progression`.
- **Disposable DB Integration Script**: Standalone test runner script `tests/postgresql-validation.sql` covering all 10 scenario suites.

### 3.11 Suite 11: PostgreSQL Integration Validation Suite & Subtransaction Assertions (Phase 8.1.4)
- **100% Physical Schema Alignment**: All fixtures and table queries strictly conform to physical snake_case column names generated by Prisma schema `@map` declarations (`states(id, name, type, capital)`, `districts(id, state_id, name, headquarters)`, `total_voters`, `leading_candidate_id`, `processed_at`).
- **Subtransaction Assertion Pattern**: Replaces vulnerable `DO $$ ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'SUCCESS'; $$;` blocks with nested subtransactions utilizing explicit `v_caught_expected_error` boolean flags trapping specific SQLSTATEs (`23503`, `23514`, `23505`, `P0001`). Re-raises an exception if expected database error fails to trigger.
- **Dedicated TieResolution Model & Invariants**: Enforces statutory tie-breaking verification under RPA 1951 Section 102. Sessions cannot transition from `TIED` to `RESULT_READY_FOR_REVIEW` without a valid `tie_resolutions` record matching the declared winner.
- **Historical Candidate-Party Integrity**: Decouples tallies from mutable global candidate profile by tracking `party_id` on `CandidateNomination` and supporting independent candidates (`party_id IS NULL`).
- **Active Counting Bidirectional Tally Auto-Reconciliation**: During `COUNTING_IN_PROGRESS`, any modification to `candidate_tallies` triggers `auto_reconcile_session_votes_on_tally_change()`, obtaining `FOR UPDATE` lock on the counting session and synchronizing `total_counted_votes`.
- **Counting Round UPDATE Immutability & Re-synchronization**: Protects against tampering with `session_id` and `round_number` during `UPDATE`, prevents alteration of earlier rounds when later rounds exist, and re-evaluates `current_round` on `INSERT`, `UPDATE`, and `DELETE`.
- **23 Comprehensive Scenarios**: Validates end-to-end relational workflows from geographic hierarchy and nomination lifecycle to concurrent voting privacy and certified result publication.

### 3.12 Suite 12: Phase 8.1.5 Final SQL Trigger Corrections & Runtime Readiness Suite
- **Static Trigger Record Field Verification (`tests/architectureConsistency.test.mjs`)**: Parses every `CREATE OR REPLACE FUNCTION ... RETURNS TRIGGER` in `CUSTOM_DATABASE_INTEGRITY.sql`, maps each trigger `ON <table_name>` to its physical columns in `PRISMA_SCHEMA_DRAFT.prisma`, and verifies that every `NEW.<field>` and `OLD.<field>` reference exists on the target table (preventing defects like the former nonexistent `NEW.lead_candidate_id` reference).
- **Exact Historical Nomination-Party Equality (Scenarios 24–25)**: Verifies that changing `candidates.party_id` does not affect historical tallies, rejects tallies whose `party_id` mismatches `candidate_nominations.party_id` (even if it matches the candidate's new global party), rejects non-NULL `party_id` for independent nominations (`party_id IS NULL`), and blocks mutating `candidate_nominations.party_id` once dependent tallies exist.
- **`CandidateTally.session_id` Immutability (Scenario 26)**: Verifies that `UPDATE candidate_tallies SET session_id = ...` is rejected with `P0001`, preventing silent cross-session tally movement and stale source-session totals.
- **10-Rule Simulated `TieResolution` Insert Validation & `onDelete: Restrict` (Scenarios 27–31)**:
  - Rejects `TieResolution` insertion when the session is not in `TIED` status.
  - Rejects `TieResolution` insertion when `selected_winner_id` is not tied for the top vote total (`MAX(votes)`).
  - Rejects `TieResolution` insertion when `approved_by_admin_id` is inactive, has role `READ_ONLY_AUDITOR`, violates `STATE_ADMIN` state jurisdiction, or lacks `admin_election_scopes` for `ELECTION_OFFICER`.
  - Rejects `TieResolution` insertion with empty `justification_note` or invalid `resolution_method`.
  - Rejects deleting or updating a `tie_resolutions` row or deleting a `counting_sessions` row that has tie-resolution evidence (`ON DELETE RESTRICT` + `trg_protect_counting_session_deletion`).
  - Rejects changing `winner_candidate_id` during publication away from `tie_resolutions.selected_winner_id`.
- **Clear Separation of Static vs. Live PostgreSQL Verification**:
  - `npm test` runs Node.js domain unit tests and static SQL/Prisma/trigger architecture consistency checks (`tests/architectureConsistency.test.mjs`).
  - `tests/postgresql-validation.sql` (31 scenarios) requires a live PostgreSQL 16+ server (`psql -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql`) and is never claimed as executed when only static Node.js tests have run.

### 3.13 Suite 13: Phase 8.1.6 Final Tie Integrity, Publication Workflow & PostgreSQL 16 CI Verification Suite
- **Genuine Tie Proof From `candidate_tallies` Joined With `candidate_nominations` (Scenario 28a–28i)**:
  1. Genuine two-candidate tie (`500` vs `500`) — accepted (`Scenario 28i`).
  2. Genuine three-way tie (`500` vs `500` vs `500`) — accepted (`Scenario 28h`).
  3. Single candidate with highest votes — rejected (`v_top_tied_count < 2`, `Scenario 28f`).
  4. Unique highest candidate (`600` vs `400`) — rejected (`v_top_tied_count < 2`, `Scenario 28e`).
  5. Zero votes for all candidates (`0` vs `0`) — rejected (`v_max_votes <= 0`, `Scenario 28d`).
  6. Missing candidate tallies (`0` rows in `candidate_tallies`) — rejected (`v_total_tally_count = 0`, `Scenario 28c`).
  7. Selected winner not among tied top candidates (`500` vs `500` vs `250`) — rejected (`v_winner_votes != v_max_votes`, `Scenario 28b`).
  8. Unapproved candidate (`status = 'UNDER_REVIEW'`) excluded from highest-vote comparison so remaining single `APPROVED` candidate cannot form a tie — rejected (`v_top_tied_count < 2`, `Scenario 28g`).
- **Two-Step Post-Tie Publication Workflow (`TIED → RESULT_READY_FOR_REVIEW → PUBLISHED`, Scenario 31)**:
  - Creates a valid tied session (`SESS_PC3_ACTIVE`), inserts valid `tie_resolutions` evidence (`selected_winner_id = 'TEST_CAND_2'`), transitions `TIED → RESULT_READY_FOR_REVIEW`, attempts `RESULT_READY_FOR_REVIEW → PUBLISHED` with a different winner (`TEST_CAND_IND`) and verifies rejection specifically with `does not match resolved winner (%) in tie_resolutions`, verifies the session remains in `RESULT_READY_FOR_REVIEW` with `is_published = FALSE`, then publishes with `winner_candidate_id = 'TEST_CAND_2'` and verifies `status = 'PUBLISHED'`, `is_published = TRUE`, `published_by_admin_id`, and `published_at`.
- **Specific Error Message & Constraint Verification Across All Negative SQL Tests**:
  - Every negative subtransaction block in `tests/postgresql-validation.sql` asserts both the expected `SQLSTATE` and the specific expected constraint name or trigger error message (`v_err_msg LIKE '%...%'`).
- **Programmatic Prisma Model & Enum Inventory Synchronization (`tests/prismaInventory.mjs`)**:
  - Extracts all 25 models and 17 enums directly from `docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma` and verifies that all architecture documents and audit reports match the schema 100%.

---

## 4. CI/CD Pipeline Integration & Reproducible 5-Step PostgreSQL 16 Bootstrap

The automated GitHub Actions workflow (`.github/workflows/ci.yml`) executes two parallel jobs (`verify` for Frontend Build/Lint/Typecheck/Unit/Playwright E2E, and `postgres-validation` for PostgreSQL 16 Schema, Trigger & Integration Validation):
```bash
# Job 1: Frontend & Static Architecture Verification (verify)
npm ci
npm run lint          # ESLint across all JS/TS files
npm run typecheck     # TypeScript compiler validation (tsc --noEmit)
npm test              # node:test suites (37 frontend + 55 static architecture tests = 92 tests)
npm run build         # Vite production bundle compilation
npm run test:e2e      # 12 Playwright Chromium browser specs

# Job 2: Disposable PostgreSQL 16 Integration Validation (postgres-validation)
# Step 1: Create disposable PostgreSQL 16 database
psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ovs_validation_db WITH (FORCE);"
psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ovs_validation_db;"

# Step 2: Validate & push Prisma schema (creates all 25 tables and 17 enums using pinned prisma@6.4.1)
npx prisma validate --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma
npx prisma db push --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma --skip-generate

# Step 3: Apply CUSTOM_DATABASE_INTEGRITY.sql constraints and triggers
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql

# Step 4: Execute PostgreSQL integration validation suite (31 scenarios)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql

# Step 5: Clean up disposable database
psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ovs_validation_db WITH (FORCE);"
```


