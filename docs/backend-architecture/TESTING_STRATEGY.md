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

---

## 4. CI/CD Pipeline Integration

The automated GitHub Actions workflow (`.github/workflows/ci.yml`) executes the entire verification pipeline on every pull request:
```bash
# 1. Static Analysis & Type Safety
npm run lint          # ESLint across all JS/TS files
npm run typecheck     # TypeScript compiler validation (tsc --noEmit)

# 2. Domain, Architecture & Unit Tests
npm test              # node:test suites (electionArchitecture.test.mjs + architectureConsistency.test.mjs)

# 3. Backend API & Database Tests (PostgreSQL service container)
npm run test:backend  # Supertest integration test suite

# 4. Production Build Verification
npm run build         # Vite production bundle compilation

# 5. Real Browser E2E Test Suite
npm run test:e2e      # 12 Playwright Chromium browser specs
```
