# OVS PostgreSQL Database Design (Phase 8.1.2 Hardened)

## 1. Relational Modeling Strategy & Physical Database Naming Convention

The OVS database is structured as a **3NF-normalized relational schema** implemented in PostgreSQL 16+. It reflects the electoral geography of India, dual-constituency voter assignment, concurrent election lifecycles, and a strict architectural decoupling between simulated voter participation and independent counting sessions.

### 1.1 Physical Database Naming Standard: `snake_case`
- **Tables**: Pluralized `snake_case` (e.g. `states`, `parliamentary_constituencies`, `election_constituencies`, `candidate_nominations`, `counting_sessions`, `admin_election_scopes`).
- **Columns**: Unambiguous `snake_case` (e.g. `parliamentary_constituency_id`, `assembly_constituency_id`, `election_id`, `is_published`, `total_counted_votes`).
- **Prisma Schema Declarations**: Every model uses `@@map("table_name")` and every camelCase field uses `@map("column_name")`. This guarantees that queries, Prisma Client, and PostgreSQL DDL align without naming drift.
- **Enums**: PascalCase in Prisma (`ElectionType`, `ConstituencyType`), mapped to PostgreSQL enum types `"ElectionType"`, `"ConstituencyType"`.

---

## 2. Prisma-to-PostgreSQL Mapping Verification Table

The following verification table demonstrates the 1-to-1 mapping between Prisma models/fields and physical PostgreSQL tables/columns across all **24 models**:

| # | Prisma Model | Prisma Field | Physical Database Table | Physical Database Column | SQL Type / Constraint |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `State` | `officialLanguages` | `states` | `official_languages` | `TEXT[] NOT NULL` |
| 1 | `State` | `totalLokSabhaSeats` | `states` | `total_lok_sabha_seats` | `INTEGER NOT NULL` |
| 1 | `State` | `metadataSource` | `states` | `metadata_source` | `ENUM NOT NULL` |
| 2 | `District` | `stateId` | `districts` | `state_id` | `VARCHAR(10) NOT NULL` |
| 3 | `ParliamentaryConstituency` | `constituencyNumber` | `parliamentary_constituencies` | `constituency_number` | `INTEGER NOT NULL` |
| 3 | `ParliamentaryConstituency` | `reservationType` | `parliamentary_constituencies` | `reservation_type` | `ENUM NOT NULL` |
| 4 | `AssemblyConstituency` | `parentParliamentaryConstituencyId` | `assembly_constituencies` | `parent_parliamentary_constituency_id` | `VARCHAR(50) NOT NULL` |
| 4 | `AssemblyConstituency` | `districtId` | `assembly_constituencies` | `district_id` | `VARCHAR(50) NOT NULL` |
| 5 | `User` | `passwordHash` | `users` | `password_hash` | `VARCHAR(255) NOT NULL` |
| 5 | `User` | `failedLoginAttempts` | `users` | `failed_login_attempts` | `INTEGER NOT NULL` |
| 6 | `VoterProfile` | `epicNumber` | `voter_profiles` | `epic_number` | `VARCHAR(20) UNIQUE NOT NULL` |
| 6 | `VoterProfile` | `parliamentaryConstituencyId` | `voter_profiles` | `parliamentary_constituency_id` | `VARCHAR(50) NOT NULL` |
| 6 | `VoterProfile` | `assemblyConstituencyId` | `voter_profiles` | `assembly_constituency_id` | `VARCHAR(50) NOT NULL` |
| 7 | `UserSession` | `userId` | `user_sessions` | `user_id` | `UUID NOT NULL` |
| 7 | `UserSession` | `expiresAt` | `user_sessions` | `expires_at` | `TIMESTAMPTZ(6) NOT NULL` |
| 8 | `AuthChallenge` | `otpHash` | `auth_challenges` | `otp_hash` | `VARCHAR(255) NOT NULL` |
| 8 | `AuthChallenge` | `maxAttempts` | `auth_challenges` | `max_attempts` | `INTEGER NOT NULL` |
| 9 | `Election` | `pollingStartDate` | `elections` | `polling_start_date` | `DATE NOT NULL` |
| 9 | `Election` | `demoSandboxMode` | `elections` | `demo_sandbox_mode` | `VARCHAR(50) NOT NULL` |
| 10 | `ElectionConstituency` | `electionId` | `election_constituencies` | `election_id` | `VARCHAR(50) NOT NULL` |
| 10 | `ElectionConstituency` | `parliamentaryConstituencyId` | `election_constituencies` | `parliamentary_constituency_id` | `VARCHAR(50) NULL` |
| 11 | `ElectionLifecycleHistory` | `changedByAdminId` | `election_lifecycle_history` | `changed_by_admin_id` | `UUID NULL` |
| 12 | `PoliticalParty` | `symbolUrl` | `political_parties` | `symbol_url` | `VARCHAR(500) NOT NULL` |
| 13 | `Candidate` | `partyId` | `candidates` | `party_id` | `VARCHAR(50) NOT NULL` |
| 13 | `Candidate` | `assetsDeclared` | `candidates` | `assets_declared` | `BIGINT NOT NULL` |
| 14 | `CandidateNomination` | `candidateId` | `candidate_nominations` | `candidate_id` | `VARCHAR(50) NOT NULL` |
| 14 | `CandidateNomination` | `scrutinyNote` | `candidate_nominations` | `scrutiny_note` | `TEXT NOT NULL` |
| 15 | `AdminUser` | `officerCode` | `admin_users` | `officer_code` | `VARCHAR(50) UNIQUE NOT NULL` |
| 15 | `AdminUser` | `assignedStateId` | `admin_users` | `assigned_state_id` | `VARCHAR(10) NULL` |
| 16 | `AdminElectionScope` | `adminUserId` | `admin_election_scopes` | `admin_user_id` | `UUID NOT NULL` |
| 16 | `AdminElectionScope` | `electionId` | `admin_election_scopes` | `election_id` | `VARCHAR(50) NOT NULL` |
| 17 | `AdminActionLog` | `targetEntityId` | `admin_action_logs` | `target_entity_id` | `VARCHAR(100) NOT NULL` |
| 18 | `DemoParticipation` | `voterId` | `demo_participations` | `voter_id` | `UUID NOT NULL` |
| 18 | `DemoParticipation` | `demoReference` | `demo_participations` | `demo_reference` | `VARCHAR(30) NOT NULL` |
| 19 | `CountingSession` | `totalConfiguredRounds` | `counting_sessions` | `total_configured_rounds` | `INTEGER NOT NULL` |
| 19 | `CountingSession` | `totalCountedVotes` | `counting_sessions` | `total_counted_votes` | `INTEGER NOT NULL` |
| 19 | `CountingSession` | `publishedByAdminId` | `counting_sessions` | `published_by_admin_id` | `UUID NULL` |
| 20 | `CountingRound` | `roundVotes` | `counting_rounds` | `round_votes` | `INTEGER NOT NULL` |
| 20 | `CountingRound` | `cumulativeVotes` | `counting_rounds` | `cumulative_votes` | `INTEGER NOT NULL` |
| 21 | `CandidateTally` | `voteSharePercentage` | `candidate_tallies` | `vote_share_percentage` | `DECIMAL(5, 2) NOT NULL` |
| 22 | `ResultCorrectionHistory` | `correctedByAdminId` | `result_correction_history` | `corrected_by_admin_id` | `UUID NOT NULL` |
| 23 | `Announcement` | `targetConstituencyType` | `announcements` | `target_constituency_type` | `ENUM NULL` |
| 24 | `VoterNotification` | `isRead` | `voter_notifications` | `is_read` | `BOOLEAN NOT NULL` |

---

## 3. Candidate Nomination & Counting Integrity

### 3.1 Statutory Candidate Nomination Uniqueness (Section 33(7) RPA 1951)
- Under Section 33(7) of the *Representation of the People Act, 1951*, a candidate is legally permitted to contest from **up to two constituencies** in an election (e.g. Narendra Modi contesting Varanasi and Vadodara in 2014; Rahul Gandhi contesting Wayanad and Raebareli in 2024).
- The overly restrictive `@@unique([candidateId, electionId])` has been replaced with:
  1. Partial unique indexes guaranteeing that a candidate cannot be nominated twice in the exact same constituency:
     ```sql
     CREATE UNIQUE INDEX uq_nomination_candidate_election_pc 
       ON candidate_nominations (candidate_id, election_id, parliamentary_constituency_id) 
       WHERE parliamentary_constituency_id IS NOT NULL;
     CREATE UNIQUE INDEX uq_nomination_candidate_election_ac 
       ON candidate_nominations (candidate_id, election_id, assembly_constituency_id) 
       WHERE assembly_constituency_id IS NOT NULL;
     ```
  2. A PostgreSQL trigger `trg_verify_candidate_nomination_compatibility` enforcing the statutory ceiling of at most 2 active nominations per candidate per election.

### 3.2 Candidate Tally & Approved Nomination Binding
Every vote tally in `candidate_tallies` must strictly satisfy:
1. **Valid Counting Session**: Foreign key `session_id REFERENCES counting_sessions(id)`.
2. **Approved Nomination**: Trigger `trg_verify_candidate_tally_nomination` verifies that a row exists in `candidate_nominations` with `status = 'APPROVED'`, matching the candidate, the election, and the exact constituency (PC or AC).
3. **Party Consistency**: Enforced declaratively by composite foreign key `FOREIGN KEY (candidate_id, party_id) REFERENCES candidates(id, party_id)`.
4. **NOTA Representation**: NOTA is strictly modeled as `counting_sessions.nota_votes` and cannot be entered as a candidate tally.
5. **Winner & Runner-Up Validation**: Trigger `trg_verify_counting_session_candidates` validates that any declared winner or runner-up holds an `APPROVED` nomination in that constituency, and that winner != runner-up.

---

## 4. Election-to-Constituency Compatibility

Elections and constituencies must obey constitutional boundaries:
- **Lok Sabha General Elections (`LOK_SABHA`)**:
  - Can ONLY map to Parliamentary Constituencies (`constituency_type = 'PARLIAMENTARY'`).
  - `state_id` on the election must be `NULL` (national scope).
  - Enforced in `election_constituencies`, `candidate_nominations`, and `counting_sessions`.
- **State Legislative Assembly Elections (`STATE_ASSEMBLY`)**:
  - Can ONLY map to Assembly Constituencies (`constituency_type = 'ASSEMBLY'`).
  - `state_id` on the election must be `NOT NULL`.
  - **Constituency State Match**: The referenced Assembly Constituency's `state_id` must match `election.state_id`.
- **Enforcement Architecture**:
  - Declarative `CHECK` constraints enforce mutual exclusivity of PC and AC foreign keys.
  - PostgreSQL triggers (`trg_verify_election_constituency_compatibility`, `trg_verify_nomination_election_compatibility`, and `trg_verify_counting_session_compatibility`) enforce cross-table type and state consistency.

---

## 5. Result Publication State Machine Hardening

The counting engine enforces a deterministic 10-state lifecycle:
`DRAFT` → `COUNTING_IN_PROGRESS` → `COUNTING_PAUSED` / `COUNTING_COMPLETED` → `RESULT_READY_FOR_REVIEW` → `PUBLISHED`
with auxiliary states: `TIED`, `UNDER_REVIEW`, `CORRECTED`, `UNPUBLISHED`.

### Mandatory Publication Rules:
1. **No Direct Insertion**: Sessions cannot be inserted directly with `is_published = TRUE` or `status = 'PUBLISHED'`. They must be initialized in `DRAFT`.
2. **Review Stage Prerequisite**: Results cannot be published directly from `DRAFT` or `COUNTING_COMPLETED`. Publication **strictly requires** an approved review stage (`RESULT_READY_FOR_REVIEW` → `PUBLISHED`).
3. **Completion Requirement**: Counting must be complete (`current_round >= total_configured_rounds`).
4. **No Unresolved Ties**: Results in `TIED` status cannot be published without formal documented resolution.
5. **Accountability**: Publication requires `published_by_admin_id` and timestamp `published_at`.
6. **Immutable Correction History**: Transition from `UNDER_REVIEW` to `CORRECTED` requires an entry in `result_correction_history`.
7. **Database-Level Enforcement**: Enforced by the `trg_verify_counting_session_publication` trigger on both `INSERT` and `UPDATE` operations.

---

## 6. Counting Reconciliation & Mathematical Integrity

The relationship between vote tallies and counting sessions is mathematically strict:
1. **Constituency Total Reconciliation**:
   $$\text{total\_counted\_votes} = \sum (\text{candidate\_tallies.votes}) + \text{nota\_votes} + \text{rejected\_votes}$$
   Enforced by trigger `trg_reconcile_counting_session_votes` whenever counting completes or results are published.
2. **Round Progression Invariants**:
   - Round numbers must be sequential: $1, 2, \dots, N \le \text{total\_configured\_rounds}$.
   - Cumulative votes must be monotonic non-decreasing:
     $$\text{cumulative\_votes}_N \ge \text{cumulative\_votes}_{N-1}$$
   - Round delta equality:
     $$\text{round\_votes}_N = \text{cumulative\_votes}_N - \text{cumulative\_votes}_{N-1}$$
   - Round 1 base case: $\text{round\_votes}_1 = \text{cumulative\_votes}_1$.
   - Final round cumulative votes must equal the session's $\text{total\_counted\_votes}$.
   - Enforced by trigger `trg_verify_counting_round_progression`.
3. **Bounds**: All vote quantities $\ge 0$, vote shares between $0.00\%$ and $100.00\%$ via declarative `CHECK` constraints.

---

## 7. Custom PostgreSQL SQL Integrity Script

All DDL, constraints, triggers, and procedural functions are centralized in:
`docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql`.
