# OVS Backend Testing Strategy & Quality Assurance Framework (Phase 8.1.1 Corrected)

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
        /-------------\ Database Constraint & Repository Tests
       /  Repository   \- Foreign key cascades, composite unique constraints, CHECKs
      /-----------------\
     /   Unit & Domain   \ Pure Service Tests (Chronology, Standings, Ties, Architecture)
    /_____________________\ Zero external dependencies, fast execution (<1s)
```

---

## 2. Testing Layers & Tooling

| Tier | Tooling | Target Scope | Execution Time |
| :--- | :--- | :--- | :--- |
| **Unit & Domain Logic** | Node.js Test Runner (`node:test`) | Election lifecycle state machine, 8-milestone schedule chronology validator, tie calculation, CSV sanitization, architectural consistency (`tests/architectureConsistency.test.mjs`). | < 500 ms |
| **Database & Repositories** | PostgreSQL Test Container + Prisma Client | Composite foreign keys `(districtId, stateId)`, `(candidateId, partyId)`, partial unique indexes, check constraints. | ~ 2–3 s |
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
  - *Assertion 3*: Relational database rejects duplicate entry via `UNIQUE (voterId, electionId)` constraint.

### 3.6 Suite 6: Database Integrity & Composite Constraint Verification
- **Geographic Hierarchy**: Attempt to insert an `AssemblyConstituency` with a `districtId` in state `WB` but `stateId` set to `MH`.
  - *Assertion*: Rejected by composite foreign key `FOREIGN KEY (districtId, stateId) REFERENCES districts(id, stateId)`.
- **Constituency Type Exclusivity**: Attempt to insert an `ElectionConstituency` with both `parliamentaryConstituencyId` and `assemblyConstituencyId` populated.
  - *Assertion*: Rejected by PostgreSQL `CHECK` constraint.
- **Candidate-Party Consistency**: Attempt to record votes in `candidate_tallies` for a candidate under a party they do not belong to.
  - *Assertion*: Rejected by composite foreign key `FOREIGN KEY (candidateId, partyId) REFERENCES candidates(id, partyId)`.

---

## 4. CI/CD Pipeline Integration

The automated GitHub Actions workflow (`.github/workflows/ci.yml`) executes the entire verification pipeline on every pull request:
```bash
# 1. Static Analysis & Type Safety
npm run lint          # ESLint across all JS/TS files
npm run typecheck     # TypeScript compiler validation (tsc --noEmit)

# 2. Domain, Architecture & Unit Tests
npm test              # 37 node:test suites (electionArchitecture.test.mjs + architectureConsistency.test.mjs)

# 3. Backend API & Database Tests (PostgreSQL service container)
npm run test:backend  # Supertest integration test suite

# 4. Production Build Verification
npm run build         # Vite production bundle compilation

# 5. Real Browser E2E Test Suite
npm run test:e2e      # 12 Playwright Chromium browser specs
```
