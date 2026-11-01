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

The following verification table demonstrates the 1-to-1 mapping between Prisma models/fields and physical PostgreSQL tables/columns across all **25 models**:

| # | Prisma Model | Prisma Field | Physical Database Table | Physical Database Column | SQL Type / Constraint |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `State` | `officialLanguages` | `states` | `official_languages` | `TEXT[] NOT NULL` |
| 1 | `State` | `totalLokSabhaSeats` | `states` | `total_lok_sabha_seats` | `INTEGER NOT NULL` |
| 1 | `State` | `metadataSource` | `states` | `metadata_source` | `ENUM NOT NULL` |
| 2 | `District` | `stateId` | `districts` | `state_id` | `VARCHAR(10) NOT NULL` |
| 2 | `District` | `headquarters` | `districts` | `headquarters` | `VARCHAR(100) NOT NULL` |
| 3 | `ParliamentaryConstituency` | `constituencyNumber` | `parliamentary_constituencies` | `constituency_number` | `INTEGER NOT NULL` |
| 3 | `ParliamentaryConstituency` | `totalVoters` | `parliamentary_constituencies` | `total_voters` | `INTEGER NOT NULL` |
| 3 | `ParliamentaryConstituency` | `reservationType` | `parliamentary_constituencies` | `reservation_type` | `ENUM NOT NULL` |
| 4 | `AssemblyConstituency` | `parentParliamentaryConstituencyId` | `assembly_constituencies` | `parent_parliamentary_constituency_id` | `VARCHAR(50) NOT NULL` |
| 4 | `AssemblyConstituency` | `districtId` | `assembly_constituencies` | `district_id` | `VARCHAR(50) NOT NULL` |
| 4 | `AssemblyConstituency` | `totalVoters` | `assembly_constituencies` | `total_voters` | `INTEGER NOT NULL` |
| 5 | `User` | `passwordHash` | `users` | `password_hash` | `VARCHAR(255) NOT NULL` |
| 5 | `User` | `failedLoginAttempts` | `users` | `failed_login_attempts` | `INTEGER NOT NULL` |
| 6 | `VoterProfile` | `epicNumber` | `voter_profiles` | `epic_number` | `VARCHAR(20) UNIQUE NOT NULL` |
| 6 | `VoterProfile` | `parliamentaryConstituencyId` | `voter_profiles` | `parliamentary_constituency_id` | `VARCHAR(50) NOT NULL` |
| 6 | `VoterProfile` | `assemblyConstituencyId` | `voter_profiles` | `assembly_constituency_id` | `VARCHAR(50) NOT NULL` |
| 7 | `UserSession` | `userId` | `user_sessions` | `user_id` | `UUID NOT NULL` |
| 7 | `UserSession` | `expiresAt` | `user_sessions` | `expires_at` | `TIMESTAMPTZ(6) NOT NULL` |
| 8 | `AuthChallenge` | `otpHash` | `auth_challenges` | `otp_hash` | `VARCHAR(255) NOT NULL` |
| 8 | `AuthChallenge` | `maxAttempts` | `auth_challenges` | `max_attempts` | `INTEGER NOT NULL` |
| 9 | `Election` | `name` | `elections` | `name` | `VARCHAR(200) NOT NULL` |
| 9 | `Election` | `pollingStartDate` | `elections` | `polling_start_date` | `DATE NOT NULL` |
| 9 | `Election` | `demoSandboxMode` | `elections` | `demo_sandbox_mode` | `VARCHAR(50) NOT NULL` |
| 10 | `ElectionConstituency` | `electionId` | `election_constituencies` | `election_id` | `VARCHAR(50) NOT NULL` |
| 10 | `ElectionConstituency` | `parliamentaryConstituencyId` | `election_constituencies` | `parliamentary_constituency_id` | `VARCHAR(50) NULL` |
| 11 | `ElectionLifecycleHistory` | `changedByAdminId` | `election_lifecycle_history` | `changed_by_admin_id` | `UUID NULL` |
| 12 | `PoliticalParty` | `abbreviation` | `political_parties` | `abbreviation` | `VARCHAR(20) NOT NULL` |
| 12 | `PoliticalParty` | `symbolUrl` | `political_parties` | `symbol_url` | `VARCHAR(500) NOT NULL` |
| 13 | `Candidate` | `partyId` | `candidates` | `party_id` | `VARCHAR(50) NOT NULL` |
| 13 | `Candidate` | `assetsDeclared` | `candidates` | `assets_declared` | `BIGINT NOT NULL` |
| 14 | `CandidateNomination` | `candidateId` | `candidate_nominations` | `candidate_id` | `VARCHAR(50) NOT NULL` |
| 14 | `CandidateNomination` | `partyId` | `candidate_nominations` | `party_id` | `VARCHAR(50) NULL (Independent)` |
| 14 | `CandidateNomination` | `scrutinyNote` | `candidate_nominations` | `scrutiny_note` | `TEXT NOT NULL` |
| 15 | `AdminUser` | `userId` | `admin_users` | `user_id` | `UUID UNIQUE NOT NULL` |
| 15 | `AdminUser` | `officerCode` | `admin_users` | `officer_code` | `VARCHAR(50) UNIQUE NOT NULL` |
| 15 | `AdminUser` | `assignedStateId` | `admin_users` | `assigned_state_id` | `VARCHAR(10) NULL` |
| 16 | `AdminElectionScope` | `adminUserId` | `admin_election_scopes` | `admin_user_id` | `UUID NOT NULL` |
| 16 | `AdminElectionScope` | `electionId` | `admin_election_scopes` | `election_id` | `VARCHAR(50) NOT NULL` |
| 17 | `AdminActionLog` | `targetEntityId` | `admin_action_logs` | `target_entity_id` | `VARCHAR(100) NOT NULL` |
| 18 | `DemoParticipation` | `voterId` | `demo_participations` | `voter_id` | `UUID NOT NULL` |
| 18 | `DemoParticipation` | `demoReference` | `demo_participations` | `demo_reference` | `VARCHAR(30) NOT NULL` |
| 19 | `CountingSession` | `totalVoters` | `counting_sessions` | `total_voters` | `INTEGER NOT NULL` |
| 19 | `CountingSession` | `totalConfiguredRounds` | `counting_sessions` | `total_configured_rounds` | `INTEGER NOT NULL` |
| 19 | `CountingSession` | `totalCountedVotes` | `counting_sessions` | `total_counted_votes` | `INTEGER NOT NULL` |
| 19 | `CountingSession` | `publishedByAdminId` | `counting_sessions` | `published_by_admin_id` | `UUID NULL` |
| 20 | `CountingRound` | `roundVotes` | `counting_rounds` | `round_votes` | `INTEGER NOT NULL` |
| 20 | `CountingRound` | `cumulativeVotes` | `counting_rounds` | `cumulative_votes` | `INTEGER NOT NULL` |
| 20 | `CountingRound` | `leadingCandidateId` | `counting_rounds` | `leading_candidate_id` | `VARCHAR(50) NULL` |
| 20 | `CountingRound` | `processedAt` | `counting_rounds` | `processed_at` | `TIMESTAMPTZ(6) NOT NULL` |
| 21 | `CandidateTally` | `nominationId` | `candidate_tallies` | `nomination_id` | `UUID NOT NULL` |
| 21 | `CandidateTally` | `partyId` | `candidate_tallies` | `party_id` | `VARCHAR(50) NULL (Independent)` |
| 21 | `CandidateTally` | `voteSharePercentage` | `candidate_tallies` | `vote_share_percentage` | `DECIMAL(5, 2) NOT NULL` |
| 22 | `ResultCorrectionHistory` | `correctedByAdminId` | `result_correction_history` | `corrected_by_admin_id` | `UUID NOT NULL` |
| 23 | `Announcement` | `targetConstituencyType` | `announcements` | `target_constituency_type` | `ENUM NULL` |
| 24 | `VoterNotification` | `isRead` | `voter_notifications` | `is_read` | `BOOLEAN NOT NULL` |
| 25 | `TieResolution` | `sessionId` | `tie_resolutions` | `session_id` | `VARCHAR(100) UNIQUE NOT NULL` |
| 25 | `TieResolution` | `selectedWinnerId` | `tie_resolutions` | `selected_winner_id` | `VARCHAR(50) NOT NULL` |
| 25 | `TieResolution` | `resolutionMethod` | `tie_resolutions` | `resolution_method` | `VARCHAR(100) NOT NULL` |
| 25 | `TieResolution` | `justificationNote` | `tie_resolutions` | `justification_note` | `TEXT NOT NULL` |
| 25 | `TieResolution` | `approvedByAdminId` | `tie_resolutions` | `approved_by_admin_id` | `UUID NOT NULL` |
| 25 | `TieResolution` | `resolvedAt` | `tie_resolutions` | `resolved_at` | `TIMESTAMPTZ(6) NOT NULL` |

### 2.1 Schema-to-Test Mapping Table (Phase 8.1.4 Verified)

The following table documents the resolution of historical test fixture naming inconsistencies, certifying that all integration tests in `tests/postgresql-validation.sql` execute against genuine physical column names:

| Target Table | Erroneous / Legacy Name in Early Tests | Correct Physical Column Name | Prisma Field Mapping | Resolution Status |
| :--- | :--- | :--- | :--- | :--- |
| `states` | `code` | *Does not exist* (`id` is the ISO state code, e.g. `'WB'`, `'DL'`) | `State.id` | **Eliminated**; using `id` |
| `states` | `jurisdiction_type` | `type` | `State.type` | **Corrected** to `type` (`"JurisdictionType"`) |
| `districts` | `district_code` | *Does not exist* (`id` is district identifier) | `District.id` | **Eliminated**; using `id` |
| `districts` | `headquarters_city` | `headquarters` | `District.headquarters` | **Corrected** to `headquarters` |
| `parliamentary_constituencies` | `total_electors` | `total_voters` | `ParliamentaryConstituency.totalVoters` | **Corrected** to `total_voters` |
| `assembly_constituencies` | `total_electors` | `total_voters` | `AssemblyConstituency.totalVoters` | **Corrected** to `total_voters` |
| `elections` | `title` | `name` | `Election.name` | **Corrected** to `name` |
| `elections` | `election_type` | `type` | `Election.type` | **Corrected** to `type` (`"ElectionType"`) |
| `elections` | `results_declaration_date` | `result_date` | `Election.resultDate` | **Corrected** to `result_date` |
| `election_constituencies` | `elector_count`, `is_counting_completed` | *Do not exist* (junction only) | N/A | **Eliminated** from fixture |
| `political_parties` | `party_code` | `abbreviation` | `PoliticalParty.abbreviation` | **Corrected** to `abbreviation` |
| `political_parties` | `founded_year` | `established_year` | `PoliticalParty.establishedYear` | **Corrected** to `established_year` |
| `counting_sessions` | *Missing `total_voters`* | `total_voters` | `CountingSession.totalVoters` | **Populated** in test fixtures |
| `counting_rounds` | Legacy abbreviated leader column | `leading_candidate_id` | `CountingRound.leadingCandidateId` | **Corrected** to `leading_candidate_id` |
| `counting_rounds` | `created_at`, `updated_at` | `processed_at`, `processed_by_admin_id` | `CountingRound.processedAt` | **Corrected** to `processed_at` |
| `admin_users` | Direct user fields (`email`, `password_hash`) | Foreign key `user_id REFERENCES users(id)` | `AdminUser.userId` | **Corrected**; `User` row inserted first |

### 2.2 Complete Prisma & PostgreSQL Enum Inventory (17 Enums — Verified Directly Against `PRISMA_SCHEMA_DRAFT.prisma`)

| # | Prisma / PostgreSQL Enum Name | Defined Values |
| :- | :--- | :--- |
| 1 | `JurisdictionType` | `STATE`, `UNION_TERRITORY` |
| 2 | `MetadataSource` | `VERIFIED_OFFICIAL`, `DEMO_SAMPLE` |
| 3 | `ReservationType` | `GENERAL`, `SC`, `ST` |
| 4 | `UserType` | `VOTER`, `ADMIN` |
| 5 | `ElectionType` | `LOK_SABHA`, `STATE_ASSEMBLY` |
| 6 | `ConstituencyType` | `PARLIAMENTARY`, `ASSEMBLY` |
| 7 | `ElectionStatus` | `DRAFT`, `SCHEDULED`, `UPCOMING`, `NOMINATION_OPEN`, `SCRUTINY_COMPLETED`, `POLLING_ACTIVE`, `POLLING_CLOSED`, `COUNTING`, `RESULTS_DECLARED`, `ARCHIVED` |
| 8 | `ParticipationStatus` | `VOTED` |
| 9 | `CandidateNominationStatus` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `SUSPENDED`, `ARCHIVED` |
| 10 | `PartyType` | `NATIONAL`, `STATE`, `INDEPENDENT` |
| 11 | `PartyStatus` | `ACTIVE`, `INACTIVE` |
| 12 | `AdminRole` | `SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`, `READ_ONLY_AUDITOR` |
| 13 | `ResultStatus` | `DRAFT`, `COUNTING_IN_PROGRESS`, `COUNTING_PAUSED`, `COUNTING_COMPLETED`, `TIED`, `RESULT_READY_FOR_REVIEW`, `PUBLISHED`, `UNDER_REVIEW`, `CORRECTED`, `UNPUBLISHED` |
| 14 | `AnnouncementCategory` | `GENERAL_INFO`, `ELECTION_SCHEDULE`, `VOTER_EDUCATION`, `SECURITY_ADVISORY`, `RESULTS` |
| 15 | `AnnouncementAudience` | `ALL_VOTERS`, `SPECIFIC_STATE`, `SPECIFIC_ELECTION`, `SPECIFIC_CONSTITUENCY` |
| 16 | `AnnouncementStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| 17 | `NotificationType` | `ELECTION_ANNOUNCEMENT`, `REGISTRATION_UPDATE`, `REMINDER` |

---

## 3. Candidate Nomination & Counting Integrity

### 3.1 Statutory Candidate Nomination Uniqueness & Advisory Locking (Section 33(7) RPA 1951)
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
  2. Transaction-Safe Advisory Locking: A PostgreSQL trigger `trg_verify_candidate_nomination_compatibility` serializes concurrent nomination attempts for the same candidate and election using `pg_advisory_xact_lock(hashtext('candidate_nomination_limit:' || candidate_id || ':' || election_id))`.

### 3.2 Candidate Tally, Session Immutability & Historical Nomination-Party Binding (Phase 8.1.5 Hardened)
Every vote tally in `candidate_tallies` must strictly satisfy:
1. **Valid Counting Session & Session Immutability**: Foreign key `session_id REFERENCES counting_sessions(id) ON DELETE CASCADE`. On `UPDATE`, `session_id` and `candidate_id` are strictly immutable (`trg_verify_candidate_tally_nomination` and `trg_protect_and_reconcile_candidate_tallies` reject any attempt to reassign a tally row to a different counting session or candidate).
2. **Approved Nomination Foreign Key & Composite Party Key**: Explicit foreign key `nomination_id REFERENCES candidate_nominations(id) ON DELETE RESTRICT`, reinforced by `uq_nomination_id_candidate_party UNIQUE (id, candidate_id, party_id)` and `fk_tally_nomination_candidate_party FOREIGN KEY (nomination_id, candidate_id, party_id) REFERENCES candidate_nominations(id, candidate_id, party_id) MATCH SIMPLE ON DELETE RESTRICT ON UPDATE RESTRICT`.
3. **Approved Nomination Trigger Verification**: Trigger `trg_verify_candidate_tally_nomination` locks the parent `counting_sessions` row `FOR UPDATE` and the `candidate_nominations` row `FOR SHARE`, verifying that the nomination is in `status = 'APPROVED'`, matches the candidate, the election, and the exact constituency (PC or AC).
4. **Exact Historical Nomination-Party Equality**: `CandidateTally.party_id` is compared strictly against `CandidateNomination.party_id` (`NEW.party_id IS NOT DISTINCT FROM v_nom_party_id`). Fallback to the mutable global `candidates.party_id` is completely removed:
   - If the nomination has a political party (`v_nom_party_id IS NOT NULL`), the tally must specify that exact `party_id` (or if omitted on `INSERT`, it is auto-populated from `v_nom_party_id`).
   - If the nomination is for an independent candidate (`v_nom_party_id IS NULL`), `NEW.party_id` must be `NULL`.
   - Changing `candidates.party_id` for a future election never alters or invalidates historical `candidate_nominations` or `candidate_tallies`.
5. **Lifecycle & Party Immutability Guard**: Trigger `trg_protect_nomination_lifecycle` prevents deleting, modifying the constituency/election/candidate/party (`party_id`) of, or invalidating (`REJECTED`, `WITHDRAWN`, `SUSPENDED`) an approved nomination while dependent candidate tallies or session declarations (winner/runner-up) exist.
6. **NOTA Representation**: NOTA is strictly modeled as `counting_sessions.nota_votes` and cannot be entered as a candidate tally.
7. **Winner, Runner-Up & Round Leader Validation**: Trigger `trg_verify_counting_session_candidates` validates that any declared winner or runner-up holds an `APPROVED` nomination in that constituency, and that winner != runner-up. Trigger `trg_verify_counting_round_progression` validates that any declared `leading_candidate_id` holds an `APPROVED` nomination in that constituency.

---

## 4. Election-to-Constituency Compatibility & Mapping Integrity

Elections and constituencies must obey constitutional boundaries and explicit mapping rules:
- **Lok Sabha General Elections (`LOK_SABHA`)**:
  - Can ONLY map to Parliamentary Constituencies (`constituency_type = 'PARLIAMENTARY'`).
  - `state_id` on the election must be `NULL` (national scope).
  - Enforced in `election_constituencies`, `candidate_nominations`, and `counting_sessions`.
- **State Legislative Assembly Elections (`STATE_ASSEMBLY`)**:
  - Can ONLY map to Assembly Constituencies (`constituency_type = 'ASSEMBLY'`).
  - `state_id` on the election must be `NOT NULL`.
  - **Constituency State Match**: The referenced Assembly Constituency's `state_id` must match `election.state_id`.
- **Explicit ElectionConstituency Membership**:
  - A candidate nomination or counting session cannot reference a constituency unless that constituency has been explicitly mapped to that election in `election_constituencies`.
  - Enforced via `trg_verify_candidate_nomination_compatibility` and `trg_verify_counting_session_compatibility`.
- **Mapping Deletion Protection**:
  - `trg_prevent_election_constituency_mutation`: `election_constituencies` rows cannot be deleted or mutated while dependent candidate nominations or counting sessions exist.

---

## 5. Result Publication State Machine & Simulated Tie Resolution Hardening (Phase 8.1.5)

The counting engine enforces a deterministic 10-state lifecycle:
`DRAFT` → `COUNTING_IN_PROGRESS` → `COUNTING_PAUSED` / `COUNTING_COMPLETED` → `RESULT_READY_FOR_REVIEW` → `PUBLISHED`
with auxiliary states: `TIED`, `UNDER_REVIEW`, `CORRECTED`, `UNPUBLISHED`.

### 5.1 Mandatory Publication Rules:
1. **Publication Equivalence CHECK Constraint**: Declarative engine-level constraint `chk_counting_session_publication_equivalence` enforces:
   $$\text{status} = \text{'PUBLISHED'} \iff \text{is\_published} = \text{TRUE}$$
2. **Initial State Invariant**: Sessions must be created in `DRAFT` status with `is_published = FALSE`. Direct insertion as `PUBLISHED` is physically rejected.
3. **Review Stage Prerequisite**: Results cannot be published directly from `DRAFT` or `COUNTING_COMPLETED`. Publication **strictly requires** an approved review stage (`RESULT_READY_FOR_REVIEW` → `PUBLISHED`).
4. **Completion & Physical Round Existence**: Counting must be complete (`current_round >= total_configured_rounds`) AND all configured counting round records must physically exist in `counting_rounds`.
5. **No Unresolved Ties**: Results in `TIED` status cannot be published without a verified simulated tie-resolution record in `tie_resolutions`.
6. **Accountability**: Publication requires `published_by_admin_id` and timestamp `published_at`.
7. **Immutable Correction History**: Transition from `UNDER_REVIEW` to `CORRECTED` requires an entry in `result_correction_history`.

### 5.2 Simulated Educational Tie Resolution (`TieResolution`) & Genuine Tie Proof (Phase 8.1.6 Hardened):
To model tie-breaking workflows in this educational election simulation without claiming legally authoritative certification:
1. **Dedicated `BEFORE INSERT` Trigger (`trg_verify_tie_resolution_insert`)**:
   - **Session Existence & Lock**: Acquires `FOR UPDATE` lock on the parent `counting_sessions` row.
   - **Tied Status Precondition**: The counting session must currently be in `status = 'TIED'` (however, `status = 'TIED'` alone never proves a tie exists).
   - **Single Resolution Per Session**: Enforced by `UNIQUE (session_id)` and trigger check.
   - **Approved Nomination Verification**: `selected_winner_id` must hold an `APPROVED` nomination in the session's exact election and constituency (`FOR SHARE` lock).
   - **Genuine Tie Proof From `candidate_tallies` Joined With `candidate_nominations`**:
     1. Candidate tallies must exist for the session (`v_total_tally_count > 0`); missing tallies are rejected.
     2. Only candidates holding an `APPROVED` nomination in the exact session election and constituency participate in highest-vote comparison (`JOIN candidate_nominations cn ON cn.id = ct.nomination_id AND cn.candidate_id = ct.candidate_id ... AND cn.status = 'APPROVED'`). Unapproved candidates cannot contribute to a tie.
     3. The maximum vote count among eligible `APPROVED` candidates must be strictly greater than zero (`v_max_votes > 0`). Zero-vote ties are rejected.
     4. At least two eligible `APPROVED` candidates must share that exact highest vote count (`v_top_tied_count >= 2`). Single-candidate sessions or unique-leader sessions are rejected.
     5. The selected winner must be one of the tied top candidates (`v_winner_votes = v_max_votes`).
   - **Active Authorized Admin Verification**: `approved_by_admin_id` must exist in `admin_users`, have `is_active = TRUE` (and linked `users.is_active = TRUE`), hold role `SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, or `ELECTION_OFFICER` (`READ_ONLY_AUDITOR` is rejected), satisfy state jurisdiction (`assigned_state_id` matching constituency state for `STATE_ADMIN`), and have an explicit `admin_election_scopes` entry when role is `ELECTION_OFFICER`.
   - **Controlled Decision & Method Values**: `decision` must be in `('WINNER_SELECTED_BY_LOT', 'SIMULATED_DRAW_WINNER_DECLARED', 'RECOUNT_TIE_BROKEN_BY_LOT', 'SIMULATED_TIE_BROKEN_DRAW_OF_LOTS')`; `resolution_method` must be in `('SIMULATED_DRAW_OF_LOTS', 'DRAW_OF_LOTS', 'SIMULATED_RO_LOTTERY', 'DRAW_OF_LOTS_RO_SECTION_102_RPA_1951')`; `justification_note` must be non-empty ($\ge 10$ characters).
2. **Mandatory Two-Step Publication Workflow (`TIED → RESULT_READY_FOR_REVIEW → PUBLISHED`)**:
   - A `TIED` session cannot transition directly to `PUBLISHED`. It must first transition to `RESULT_READY_FOR_REVIEW` with `winner_candidate_id` matching `tie_resolutions.selected_winner_id`, and then transition from `RESULT_READY_FOR_REVIEW` to `PUBLISHED`.
   - Trigger `trg_verify_counting_session_publication` verifies that whenever a `tie_resolutions` row exists for a session, `counting_sessions.winner_candidate_id` equals `tie_resolutions.selected_winner_id` in both `RESULT_READY_FOR_REVIEW` and `PUBLISHED` states.
3. **Referential & Deletion Consistency (`onDelete: Restrict`)**:
   - Both Prisma (`TieResolution.session` with `onDelete: Restrict`) and PostgreSQL (`fk_tie_res_session REFERENCES counting_sessions(id) ON DELETE RESTRICT ON UPDATE RESTRICT`) use `RESTRICT`.
   - `trg_protect_tie_resolution_immutability` unconditionally rejects `UPDATE` and `DELETE` on `tie_resolutions`.
   - `trg_protect_counting_session_deletion` prevents deleting any counting session that has tie-resolution evidence or is published.

---

## 6. Bidirectional Counting Reconciliation & Deterministic Lock Ordering

### 6.1 Bidirectional Constituency Total Reconciliation
1. **Formula**:
   $$\text{total\_counted\_votes} = \sum (\text{candidate\_tallies.votes}) + \text{nota\_votes} + \text{rejected\_votes}$$
   - On `counting_sessions` updates: Enforced by trigger `trg_reconcile_counting_session_votes` whenever counting completes or results are published. Handles zero-vote tallies and empty tally states using `COALESCE(SUM(votes), 0)` without bypass.
   - On `candidate_tallies` mutations: Trigger `trg_protect_and_reconcile_candidate_tallies` locks the session row `FOR UPDATE` and forbids modifying completed, tied, reviewed, or published counting tallies without an explicit recount (`UNDER_REVIEW`) workflow.
2. **Counting Round Progression & Immutability**:
   - Round numbers must be sequential: $1, 2, \dots, N \le \text{total\_configured\_rounds}$.
   - Cumulative votes must be monotonic non-decreasing: $\text{cumulative\_votes}_N \ge \text{cumulative\_votes}_{N-1}$.
   - Round delta equality: $\text{round\_votes}_N = \text{cumulative\_votes}_N - \text{cumulative\_votes}_{N-1}$, with Round 1 base case $\text{round\_votes}_1 = \text{cumulative\_votes}_1$.
   - Earlier rounds cannot be modified while subsequent rounds exist.
   - `trg_protect_counting_round_deletion` enforces that completed rounds cannot be deleted, and rounds in progress can only be rolled back in strict reverse order ($N, N-1, \dots$).
   - `trg_synchronize_session_current_round` automatically synchronizes `counting_sessions.current_round`.

### 6.2 Deterministic Transaction Lock Ordering Hierarchy
To prevent deadlocks during concurrent counting, tally updates, nomination checks, and tie resolutions, all triggers and services follow a strict top-down lock acquisition order:
1. **Level 1 — Advisory Locks (when applicable)**: `pg_advisory_xact_lock(hashtext('candidate_nomination_limit:' || candidate_id || ':' || election_id))` during candidate nomination creation/update.
2. **Level 2 — Parent CountingSession Row Lock (`FOR UPDATE`)**: Any mutation to `counting_sessions`, `counting_rounds`, `candidate_tallies`, or `tie_resolutions` acquires `SELECT ... FROM counting_sessions WHERE id = ... FOR UPDATE` **first** before locking or querying child tables.
3. **Level 3 — Referenced CandidateNomination Row Lock (`FOR SHARE`)**: Acquired after the parent `counting_sessions` lock when validating candidate eligibility in `candidate_tallies`, `counting_rounds`, or `tie_resolutions`.
4. **Level 4 — Child Counting Tables (`counting_rounds`, `candidate_tallies`, `tie_resolutions`, `result_correction_history`)**: Read or mutated only after the parent `counting_sessions` lock is held.

---

## 7. Round Leader & Per-Round Vote Architecture (Option B Selection)

- **Design Decision**: The OVS schema adopts **Option B (Aggregate Counting Rounds with Validated Round Leader)**.
- **Rationale**:
  1. The educational simulation tracks progressive aggregate turnout and vote accumulation per round, while full candidate-by-candidate breakdowns are persisted in `candidate_tallies`.
  2. Avoids redundant intermediate tables while guaranteeing data integrity.
  3. Every `CountingRound.leading_candidate_id` is strictly verified by trigger to possess an `APPROVED` nomination for that exact election and constituency.

---

## 8. Custom PostgreSQL SQL Integrity Script & Reproducible 5-Step Schema Bootstrap

All DDL, constraints, triggers, and procedural functions are centralized in:
`docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql`.

Because `CUSTOM_DATABASE_INTEGRITY.sql` alters base tables and references PostgreSQL enum types defined in `docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma`, it **must** be executed after applying the Prisma schema in the following reproducible 5-step sequence:

```bash
# 1. Create disposable PostgreSQL 16 database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ovs_validation_db?schema=public"
psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ovs_validation_db WITH (FORCE);"
psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ovs_validation_db;"

# 2. Validate & apply Prisma schema (creates all 25 tables and 17 enums using pinned Prisma CLI)
npx --yes prisma@6.4.1 validate --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma
npx --yes prisma@6.4.1 db push --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma --skip-generate

# 3. Apply custom SQL integrity constraints and triggers
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql

# 4. Execute the PostgreSQL integration validation suite (31 scenarios)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql

# 5. Clean up disposable database
psql "postgresql://postgres:postgres@localhost:5432/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ovs_validation_db WITH (FORCE);"
```

