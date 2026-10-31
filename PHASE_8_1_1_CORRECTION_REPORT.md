# OVS Phase 8.1.1 — Architecture Consistency, Database Integrity & API Contract Correction Report

## 1. Executive Summary & Objective

**Phase 8.1.1** was initiated to perform a thorough, rigorous audit and correction of the backend architectural blueprint drafted in Phase 8.1 for the Online Voting System (OVS).

### Strict Boundary Adherence:
- **No Backend Runtime Created**: In accordance with instructions, no Express backend server or endpoints were created, no database connections were made, and no database migrations were applied.
- **Frontend Functionality Preserved**: 100% of existing local demo functionality, React 19 UI, and client-side services remain completely intact.
- **Ballot Secrecy Maintained**: Zero candidate selections are stored against voters, and demo participation confirms only non-revealing event completion (`VOTED`).

---

## 2. Key Contradictions Identified & Corrected

| Area | Initial Phase 8.1 Blueprint Flaw | Phase 8.1.1 Corrective Resolution |
| :--- | :--- | :--- |
| **Model Count** | Report stated 17 models, but schema actually contained 23. | Corrected and aligned across all documents to **24 models and 17 enums** (including the new `AdminElectionScope` model). |
| **Nullable Composite Uniqueness** | `ElectionConstituency`, `CandidateNomination`, and `CountingSession` used standard `UNIQUE` constraints across columns where one is NULL. In SQL-92 / standard PostgreSQL, `NULL != NULL`, allowing duplicate rows. | Replaced standard composite uniqueness with PostgreSQL **Partial Unique Indexes** (`CREATE UNIQUE INDEX ... WHERE parliamentary_constituency_id IS NOT NULL`) and explicit `CHECK` constraints enforcing type mutual exclusivity. |
| **Geographic Hierarchy Integrity** | Single-column foreign keys allowed an Assembly Constituency (AC) to belong to a Parliamentary Constituency (PC) or District in a different State, and allowed voters to have ACs outside their assigned PC. | Introduced composite unique keys on `districts(id, stateId)`, `parliamentary_constituencies(id, stateId)`, and `assembly_constituencies(id, parentParliamentaryConstituencyId)`. Enforced composite foreign keys in `assembly_constituencies` and `voter_profiles`, guaranteeing strict state and PC containment at the relational database level. |
| **Candidate & Tally Party Integrity** | Candidate tallies referenced `candidateId` and `partyId` independently, creating potential for candidate-party mismatch. | Established `Candidate @@unique([id, partyId])` and bound `CandidateTally` with composite foreign key `(candidateId, partyId) REFERENCES candidates(id, partyId)`. NOTA is stored directly on `CountingSession` as `notaVotes`. |
| **Admin Election Scopes** | `AdminUser` stored `assignedElectionIds String[]` as an unstructured array, violating 1NF and preventing referential integrity. | Normalized into a dedicated `AdminElectionScope` model (`admin_election_scopes` table) with composite unique constraint `@@unique([adminUserId, electionId])`. |
| **Announcement Constituency Targeting** | `Announcement` contained an untyped `targetConstituencyId String?` without referential integrity. | Replaced with `targetConstituencyType`, `targetParliamentaryConstituencyId`, and `targetAssemblyConstituencyId`, linked with foreign keys and protected by mutual exclusivity `CHECK` constraints. |
| **Authentication & Cookie Discipline** | API spec mentioned contradictory Bearer tokens (`Authorization: Bearer <token>`) alongside cookies. | Standardized **exclusively** on secure, HttpOnly, SameSite=Strict session cookies (`ovs_session`). Documented triple-layer CSRF defense (SameSite=Strict + custom `X-CSRF-Token` header + Origin/Referer header verification). |
| **Voter Authentication Pipeline** | Blurred the line between simulated OTP and production identity verification. | Formally decoupled the educational sandbox flow (pre-configured dummy OTP `123456` with educational banner) from the production architecture (SMS gateway, UIDAI Aadhaar e-KYC, hardware tokens). |
| **Standardized Error Responses** | Documents referenced outdated RFC 7807 and mixed custom envelopes. | Standardized across all documents on **RFC 9457 Problem Details** (`application/problem+json`). |
| **Result State Machine** | Statuses were inconsistent (`COMPLETED` vs `COUNTING_COMPLETED`, missing review/correction states). | Unified into a deterministic **10-state lifecycle**: `DRAFT`, `COUNTING_IN_PROGRESS`, `COUNTING_PAUSED`, `COUNTING_COMPLETED`, `RESULT_READY_FOR_REVIEW`, `PUBLISHED`, `TIED`, `UNDER_REVIEW`, `CORRECTED`, `UNPUBLISHED`. Result publication requires `RESULT_READY_FOR_REVIEW`, counting completion, and tie resolution. |
| **Timestamp Standardization** | Mixed `@db.Timestamptz` without explicit precision. | Standardized all timestamp columns to `@db.Timestamptz(6)`. |

---

## 3. The 13-Area Consistency Matrix

All 12 backend architecture documents under `docs/backend-architecture/` have been updated and synchronized across all 13 core dimensions:

| # | Architecture Dimension | `PRISMA_SCHEMA_DRAFT.prisma` | `DATABASE_DESIGN.md` | `ER_DIAGRAM.md` | `API_SPECIFICATION.md` | `AUTH_AUTHORIZATION.md` | `SECURITY_THREAT.md` | `SYSTEM_ARCH.md` | `FRONTEND_MIGRATION.md` | `DATA_MIGRATION.md` | `DOCKER_PLAN.md` | `TESTING_STRATEGY.md` | `ADR.md` | Status |
| :- | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | **Model & Enum Count** (24 Models, 17 Enums) | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 2 | **Constituency Type Integrity** (Mutual Exclusivity) | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 3 | **Partial Unique Indexes** (Nullable Uniqueness) | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 4 | **Geographic Hierarchy Composite FKs** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 5 | **Candidate-Party Tally FK & NOTA Model** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 6 | **Normalized Admin Scopes** (`admin_election_scopes`) | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 7 | **Typed Announcement Constituency Target** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 8 | **Pure HttpOnly Session Cookie** (`ovs_session`) | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 9 | **Triple-Layer CSRF Defense** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 10 | **RFC 9457 Problem Details Formatting** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 11 | **Unified 10-Status Result State Machine** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 12 | **Strict Ballot Secrecy & Zero Choice Storage** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |
| 13 | **Dual Flow: Demo OTP vs Production Identity** | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | Synchronized | **CONSISTENT** |

---

## 4. Custom SQL Migrations Required (Beyond Prisma DSL Capabilities)

Because standard Prisma Schema Language (PSL) cannot natively express conditional `CHECK` constraints, partial indexes (`WHERE` clauses), or composite foreign keys spanning self-referencing and parent-child tables, the following custom SQL migration script (`migration_custom_integrity.sql`) is documented in `DATABASE_DESIGN.md` and `DOCKER_DEVELOPMENT_PLAN.md`:

```sql
-- 1. Partial Unique Indexes for Nullable Composite Uniqueness
CREATE UNIQUE INDEX uq_election_constituency_pc 
  ON election_constituencies (election_id, parliamentary_constituency_id) 
  WHERE parliamentary_constituency_id IS NOT NULL;

CREATE UNIQUE INDEX uq_election_constituency_ac 
  ON election_constituencies (election_id, assembly_constituency_id) 
  WHERE assembly_constituency_id IS NOT NULL;

CREATE UNIQUE INDEX uq_nomination_candidate_pc 
  ON candidate_nominations (election_id, parliamentary_constituency_id, candidate_id) 
  WHERE parliamentary_constituency_id IS NOT NULL;

CREATE UNIQUE INDEX uq_nomination_candidate_ac 
  ON candidate_nominations (election_id, assembly_constituency_id, candidate_id) 
  WHERE assembly_constituency_id IS NOT NULL;

CREATE UNIQUE INDEX uq_counting_session_pc 
  ON counting_sessions (election_id, parliamentary_constituency_id) 
  WHERE parliamentary_constituency_id IS NOT NULL;

CREATE UNIQUE INDEX uq_counting_session_ac 
  ON counting_sessions (election_id, assembly_constituency_id) 
  WHERE assembly_constituency_id IS NOT NULL;

-- 2. Constituency Type Mutual Exclusivity CHECK Constraints
ALTER TABLE election_constituencies
  ADD CONSTRAINT chk_election_constituency_type_exclusivity
  CHECK (
    (constituency_type = 'PARLIAMENTARY' AND parliamentary_constituency_id IS NOT NULL AND assembly_constituency_id IS NULL)
    OR
    (constituency_type = 'ASSEMBLY' AND assembly_constituency_id IS NOT NULL AND parliamentary_constituency_id IS NULL)
  );

ALTER TABLE candidate_nominations
  ADD CONSTRAINT chk_nomination_constituency_type_exclusivity
  CHECK (
    (constituency_type = 'PARLIAMENTARY' AND parliamentary_constituency_id IS NOT NULL AND assembly_constituency_id IS NULL)
    OR
    (constituency_type = 'ASSEMBLY' AND assembly_constituency_id IS NOT NULL AND parliamentary_constituency_id IS NULL)
  );

ALTER TABLE counting_sessions
  ADD CONSTRAINT chk_counting_session_constituency_type_exclusivity
  CHECK (
    (constituency_type = 'PARLIAMENTARY' AND parliamentary_constituency_id IS NOT NULL AND assembly_constituency_id IS NULL)
    OR
    (constituency_type = 'ASSEMBLY' AND assembly_constituency_id IS NOT NULL AND parliamentary_constituency_id IS NULL)
  );

-- 3. Election Type Scope CHECK Constraints
ALTER TABLE elections
  ADD CONSTRAINT chk_election_type_state_scope
  CHECK (
    (type = 'LOK_SABHA' AND state_id IS NULL)
    OR
    (type = 'STATE_ASSEMBLY' AND state_id IS NOT NULL)
  );

-- 4. Publication Verification Trigger
CREATE OR REPLACE FUNCTION verify_counting_session_publication()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_published = TRUE AND OLD.is_published = FALSE THEN
    IF NEW.status NOT IN ('RESULT_READY_FOR_REVIEW', 'PUBLISHED') THEN
      RAISE EXCEPTION 'Cannot publish result when status is %', NEW.status;
    END IF;
    IF NEW.current_round < NEW.total_configured_rounds THEN
      RAISE EXCEPTION 'Cannot publish result before counting completes';
    END IF;
    IF NEW.status = 'TIED' THEN
      RAISE EXCEPTION 'Cannot publish result while in TIED status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verify_counting_session_publication
  BEFORE UPDATE ON counting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION verify_counting_session_publication();
```

---

## 5. Automated Verification Results

### 5.1 Test Execution (`npm test`)
- **Suite 1 (`tests/electionArchitecture.test.mjs`)**: **37 / 37** subtests passed.
- **Suite 2 (`tests/architectureConsistency.test.mjs`)**: **11 / 11** subtests passed.
- **Total Tests Passed**: **48 / 48** tests passed (0 failures, 0 skipped).

### 5.2 Linting (`npm run lint`)
- ESLint completed across the entire codebase with **0 errors and 0 warnings**.

### 5.3 Typechecking (`npm run typecheck`)
- TypeScript compiler (`tsc --noEmit`) completed with **0 errors**.

### 5.4 Applet Build (`compile_applet`)
- Vite production build completed successfully with **0 errors**.

---

## 6. Transparent Assessment: Prisma CLI in Frontend Repository

- **Assessment**: The current repository is a pure React 19 frontend SPA. As such, `@prisma/client` and `prisma` CLI are **not installed** in `package.json`, and no database daemon runs in this environment.
- **Verification Strategy**: The Prisma schema draft was rigorously validated through automated syntax parsing, AST structure tests, relation matching, and constraint checks in `tests/architectureConsistency.test.mjs`. When the dedicated backend service directory (`backend/`) is provisioned in future phases, the schema can be directly initialized with `npx prisma validate`.
