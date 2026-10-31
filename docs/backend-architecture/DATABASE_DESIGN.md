# OVS PostgreSQL Database Design

## 1. Relational Modeling Strategy & Design Goals

The OVS database is structured as a **3NF-normalized relational schema** implemented in PostgreSQL 16+. It reflects the electoral geography of India, dual-constituency voter assignment, concurrent election lifecycles, and a strict decoupling between voter participation and counting simulations.

### Key Design Goals:
1. **Relational Integrity Over Arbitrary JSON**: All core domain relationships (states, districts, constituencies, nominations, schedules, counting rounds) are modeled using dedicated relational tables with foreign keys and check constraints. JSONB is reserved strictly for audit metadata and flexible configuration overrides.
2. **Data Provenance (`MetadataSource`)**: Every entity tracks whether it represents verified official Election Commission of India data (`VERIFIED_OFFICIAL`) or demonstration sample data (`DEMO_SAMPLE`).
3. **Dual-Constituency Invariant**: Every registered voter profile references exactly one Parliamentary Constituency (`parliamentaryConstituencyId`) and one Assembly Constituency (`assemblyConstituencyId`).
4. **Strict Ballot Secrecy & Decoupling Invariant**: The `demo_participations` table records that a voter completed participation in an election (`status = 'VOTED'`), but contains **no foreign keys or fields** referencing candidates, parties, or choices. Counting sessions exist in independent tables.
5. **Auditable Lifecycle History**: Critical state changes (election status transitions, candidate scrutiny decisions, administrative result corrections) are captured in dedicated append-only history tables.

---

## 2. Entity Groups & Detailed Table Specifications

### 2.1 Group A: Electoral Geography

#### Table: `states`
Represents the 28 States and 8 Union Territories of India.
- `id` (VARCHAR(10), PRIMARY KEY): Standard state code (e.g. `'WB'`, `'MH'`, `'DL'`, `'TN'`, `'UP'`).
- `name` (VARCHAR(100), NOT NULL): Official jurisdiction name (e.g. `'West Bengal'`, `'Maharashtra'`).
- `type` (ENUM `JurisdictionType`, NOT NULL): `'STATE'` or `'UNION_TERRITORY'`.
- `capital` (VARCHAR(100), NOT NULL): Administrative capital.
- `officialLanguages` (TEXT[], NOT NULL): Array of official state languages.
- `totalLokSabhaSeats` (INTEGER, NOT NULL): Total sanctioned Parliamentary seats (summing to 543 nationally).
- `totalAssemblySeats` (INTEGER, NOT NULL): Total sanctioned State Legislative Assembly seats (summing to 4,123 nationally).
- `metadataSource` (ENUM `MetadataSource`, NOT NULL DEFAULT `'VERIFIED_OFFICIAL'`).
- `createdAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- `updatedAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).

#### Table: `districts`
Administrative districts within each state/UT.
- `id` (VARCHAR(50), PRIMARY KEY): Canonical district code (e.g. `'DIST-WB-KOL'`).
- `stateId` (VARCHAR(10), NOT NULL, FK -> `states.id` ON DELETE RESTRICT): Parent state.
- `name` (VARCHAR(100), NOT NULL): District name.
- `headquarters` (VARCHAR(100), NOT NULL): Administrative headquarters.
- `metadataSource` (ENUM `MetadataSource`, NOT NULL DEFAULT `'VERIFIED_OFFICIAL'`).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Index**: `CREATE INDEX idx_districts_state ON districts(stateId);`

#### Table: `parliamentary_constituencies` (PCs)
Lok Sabha constituencies.
- `id` (VARCHAR(50), PRIMARY KEY): Canonical PC code (e.g. `'PC-WB-KOLKATA-SOUTH'`).
- `stateId` (VARCHAR(10), NOT NULL, FK -> `states.id` ON DELETE RESTRICT): Parent state.
- `constituencyNumber` (INTEGER, NOT NULL): Official constituency sequence number.
- `name` (VARCHAR(150), NOT NULL): Official constituency name.
- `reservationType` (ENUM `ReservationType`, NOT NULL DEFAULT `'GENERAL'`): `'GENERAL'`, `'SC'`, or `'ST'`.
- `totalVoters` (INTEGER, NOT NULL DEFAULT 0): Official registered electorate count.
- `metadataSource` (ENUM `MetadataSource`, NOT NULL DEFAULT `'VERIFIED_OFFICIAL'`).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Unique Constraint**: `UNIQUE (stateId, constituencyNumber)`.
- **Index**: `CREATE INDEX idx_pcs_state ON parliamentary_constituencies(stateId);`

#### Table: `assembly_constituencies` (ACs)
State Legislative Assembly constituencies.
- `id` (VARCHAR(50), PRIMARY KEY): Canonical AC code (e.g. `'AC-WB-BHABANIPUR'`).
- `stateId` (VARCHAR(10), NOT NULL, FK -> `states.id` ON DELETE RESTRICT): Parent state.
- `districtId` (VARCHAR(50), NOT NULL, FK -> `districts.id` ON DELETE RESTRICT): Primary district location.
- `parentParliamentaryConstituencyId` (VARCHAR(50), NOT NULL, FK -> `parliamentary_constituencies.id` ON DELETE RESTRICT): Parent Lok Sabha constituency for dual mapping.
- `constituencyNumber` (INTEGER, NOT NULL): Official AC sequence number.
- `name` (VARCHAR(150), NOT NULL): Official constituency name.
- `reservationType` (ENUM `ReservationType`, NOT NULL DEFAULT `'GENERAL'`): `'GENERAL'`, `'SC'`, or `'ST'`.
- `totalVoters` (INTEGER, NOT NULL DEFAULT 0): Official registered electorate count.
- `metadataSource` (ENUM `MetadataSource`, NOT NULL DEFAULT `'VERIFIED_OFFICIAL'`).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Unique Constraint**: `UNIQUE (stateId, constituencyNumber)`.
- **Index**: `CREATE INDEX idx_acs_parent_pc ON assembly_constituencies(parentParliamentaryConstituencyId);`
- **Index**: `CREATE INDEX idx_acs_district ON assembly_constituencies(districtId);`

---

### 2.2 Group B: User & Voter Management

#### Table: `users`
Base authentication account (for voters, admins, and auditors).
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `userType` (ENUM `UserType`, NOT NULL): `'VOTER'` or `'ADMIN'`.
- `identifier` (VARCHAR(100), UNIQUE NOT NULL): EPIC voter ID (e.g. `'WBX1234567'`) or Admin Officer Code (e.g. `'ECI-SUPER-001'`).
- `passwordHash` (VARCHAR(255), NOT NULL): Argon2id password/passcode hash.
- `isActive` (BOOLEAN, NOT NULL DEFAULT TRUE).
- `failedLoginAttempts` (INTEGER, NOT NULL DEFAULT 0).
- `lockoutUntil` (TIMESTAMPTZ, NULL).
- `lastLoginAt` (TIMESTAMPTZ, NULL).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).

#### Table: `voter_profiles`
Voter demographic and constituency mapping.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `userId` (UUID, UNIQUE NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `epicNumber` (VARCHAR(20), UNIQUE NOT NULL): Electoral Photo Identity Card (EPIC) reference.
- `fullName` (VARCHAR(150), NOT NULL): Voter legal full name.
- `dateOfBirth` (DATE, NOT NULL): Used to enforce legal voting age (>= 18 years).
- `gender` (VARCHAR(20), NOT NULL): `'Male'`, `'Female'`, or `'Third Gender / Other'`.
- `mobile` (VARCHAR(15), NOT NULL): Indian 10-digit mobile number.
- `email` (VARCHAR(255), NOT NULL): Email address.
- `address` (TEXT, NOT NULL): Residential street address.
- `pinCode` (VARCHAR(10), NOT NULL): 6-digit Indian Postal PIN code.
- `stateId` (VARCHAR(10), NOT NULL, FK -> `states.id` ON DELETE RESTRICT).
- `districtId` (VARCHAR(50), NOT NULL, FK -> `districts.id` ON DELETE RESTRICT).
- `parliamentaryConstituencyId` (VARCHAR(50), NOT NULL, FK -> `parliamentary_constituencies.id` ON DELETE RESTRICT).
- `assemblyConstituencyId` (VARCHAR(50), NOT NULL, FK -> `assembly_constituencies.id` ON DELETE RESTRICT).
- `registrationDate` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- `isVerified` (BOOLEAN, NOT NULL DEFAULT TRUE).
- `metadataSource` (ENUM `MetadataSource`, NOT NULL DEFAULT `'DEMO_SAMPLE'`).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Index**: `CREATE INDEX idx_voters_geography ON voter_profiles(stateId, parliamentaryConstituencyId, assemblyConstituencyId);`

#### Table: `user_sessions`
Server-backed session tracking for authenticated users.
- `id` (VARCHAR(128), PRIMARY KEY): Cryptographically random session identifier.
- `userId` (UUID, NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `userAgent` (TEXT, NULL).
- `ipAddress` (VARCHAR(45), NULL).
- `expiresAt` (TIMESTAMPTZ, NOT NULL).
- `createdAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- **Index**: `CREATE INDEX idx_sessions_user_expiry ON user_sessions(userId, expiresAt);`

#### Table: `auth_challenges`
Tracks OTP authentication challenges.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `identifier` (VARCHAR(100), NOT NULL): Target EPIC or Officer Code.
- `otpHash` (VARCHAR(255), NOT NULL): Hashed simulated/generated OTP.
- `attempts` (INTEGER, NOT NULL DEFAULT 0).
- `maxAttempts` (INTEGER, NOT NULL DEFAULT 3).
- `expiresAt` (TIMESTAMPTZ, NOT NULL): 120-second default validity.
- `consumedAt` (TIMESTAMPTZ, NULL).
- `createdAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- **Index**: `CREATE INDEX idx_challenges_lookup ON auth_challenges(identifier, consumedAt, expiresAt);`

---

### 2.3 Group C: Election Management

#### Table: `elections`
Master record for national and state elections.
- `id` (VARCHAR(50), PRIMARY KEY): Canonical election ID (e.g. `'LS-2029'`, `'WB-ASSEMBLY-2029'`).
- `name` (VARCHAR(200), NOT NULL): Descriptive title.
- `type` (ENUM `ElectionType`, NOT NULL): `'LOK_SABHA'` or `'STATE_ASSEMBLY'`.
- `year` (INTEGER, NOT NULL): Election year.
- `stateId` (VARCHAR(10), NULL, FK -> `states.id` ON DELETE RESTRICT): Null for Lok Sabha; required for State Assembly.
- `status` (ENUM `ElectionStatus`, NOT NULL DEFAULT `'UPCOMING'`): Lifecycle state.
- `registrationDeadline` (DATE, NULL).
- `nominationStartDate` (DATE, NULL).
- `nominationEndDate` (DATE, NULL).
- `scrutinyDate` (DATE, NULL).
- `withdrawalDeadline` (DATE, NULL).
- `campaignStartDate` (DATE, NULL).
- `campaignEndDate` (DATE, NULL).
- `pollingStartDate` (DATE, NOT NULL).
- `pollingEndDate` (DATE, NOT NULL).
- `countingDate` (DATE, NOT NULL).
- `resultDate` (DATE, NOT NULL).
- `simulationClockDate` (DATE, NULL): Optional per-election clock override.
- `demoSandboxMode` (VARCHAR(50), NOT NULL DEFAULT `'CONCURRENT_SIMULATION_SANDBOX'`).
- `description` (TEXT, NOT NULL DEFAULT '').
- `metadataSource` (ENUM `MetadataSource`, NOT NULL DEFAULT `'DEMO_SAMPLE'`).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Index**: `CREATE INDEX idx_elections_status_type ON elections(status, type);`

#### Table: `election_constituencies`
Many-to-many junction mapping elections to participating constituencies.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `electionId` (VARCHAR(50), NOT NULL, FK -> `elections.id` ON DELETE CASCADE).
- `constituencyType` (ENUM `ConstituencyType`, NOT NULL): `'PARLIAMENTARY'` or `'ASSEMBLY'`.
- `parliamentaryConstituencyId` (VARCHAR(50), NULL, FK -> `parliamentary_constituencies.id` ON DELETE CASCADE).
- `assemblyConstituencyId` (VARCHAR(50), NULL, FK -> `assembly_constituencies.id` ON DELETE CASCADE).
- `createdAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- **Unique Constraint**: `UNIQUE (electionId, parliamentaryConstituencyId, assemblyConstituencyId)`.
- **Check Constraint**: Enforces PC is set if type=PARLIAMENTARY, and AC is set if type=ASSEMBLY.

#### Table: `election_lifecycle_history`
Append-only log of election status transitions.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `electionId` (VARCHAR(50), NOT NULL, FK -> `elections.id` ON DELETE CASCADE).
- `fromStatus` (ENUM `ElectionStatus`, NOT NULL).
- `toStatus` (ENUM `ElectionStatus`, NOT NULL).
- `changedByAdminId` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL).
- `changedAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- `note` (TEXT, NOT NULL DEFAULT '').
- `metadata` (JSONB, NOT NULL DEFAULT '{}').

---

### 2.4 Group D: Political Parties & Candidates

#### Table: `political_parties`
Registered national and state political parties.
- `id` (VARCHAR(50), PRIMARY KEY): Party code (e.g. `'PARTY-BJP'`, `'PARTY-INC'`, `'PARTY-AITC'`).
- `name` (VARCHAR(150), NOT NULL): Official party name.
- `abbreviation` (VARCHAR(20), NOT NULL): Short acronym (e.g. `'BJP'`, `'INC'`).
- `partyType` (ENUM `PartyType`, NOT NULL): `'NATIONAL'`, `'STATE'`, or `'INDEPENDENT'`.
- `symbolName` (VARCHAR(100), NOT NULL): Electoral symbol description.
- `symbolUrl` (VARCHAR(500), NOT NULL): Symbol asset path.
- `establishedYear` (INTEGER, NULL).
- `headquarters` (VARCHAR(150), NULL).
- `status` (ENUM `PartyStatus`, NOT NULL DEFAULT `'ACTIVE'`): `'ACTIVE'`, `'INACTIVE'`, or `'ARCHIVED'`.
- `metadataSource` (ENUM `MetadataSource`, NOT NULL DEFAULT `'DEMO_SAMPLE'`).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).

#### Table: `candidates`
Individual candidate profiles.
- `id` (VARCHAR(50), PRIMARY KEY): Canonical candidate ID (e.g. `'CAND-LS29-KRN-1'`).
- `fullName` (VARCHAR(150), NOT NULL).
- `age` (INTEGER, NOT NULL).
- `gender` (VARCHAR(20), NOT NULL).
- `education` (VARCHAR(150), NOT NULL).
- `profession` (VARCHAR(150), NOT NULL).
- `criminalCases` (INTEGER, NOT NULL DEFAULT 0).
- `assetsDeclared` (BIGINT, NOT NULL DEFAULT 0): Total assets in INR.
- `liabilitiesDeclared` (BIGINT, NOT NULL DEFAULT 0): Total liabilities in INR.
- `photoUrl` (VARCHAR(500), NULL).
- `bio` (TEXT, NOT NULL DEFAULT '').
- `partyId` (VARCHAR(50), NOT NULL, FK -> `political_parties.id` ON DELETE RESTRICT).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).

#### Table: `candidate_nominations`
Maps candidate nominations to specific elections and constituencies.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `candidateId` (VARCHAR(50), NOT NULL, FK -> `candidates.id` ON DELETE CASCADE).
- `electionId` (VARCHAR(50), NOT NULL, FK -> `elections.id` ON DELETE CASCADE).
- `constituencyType` (ENUM `ConstituencyType`, NOT NULL).
- `parliamentaryConstituencyId` (VARCHAR(50), NULL, FK -> `parliamentary_constituencies.id` ON DELETE CASCADE).
- `assemblyConstituencyId` (VARCHAR(50), NULL, FK -> `assembly_constituencies.id` ON DELETE CASCADE).
- `nominationDate` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- `status` (ENUM `CandidateNominationStatus`, NOT NULL DEFAULT `'APPROVED'`): `'DRAFT'`, `'SUBMITTED'`, `'UNDER_REVIEW'`, `'APPROVED'`, `'REJECTED'`, `'WITHDRAWN'`, `'SUSPENDED'`, `'ARCHIVED'`.
- `scrutinyNote` (TEXT, NOT NULL DEFAULT '').
- `scrutinyDate` (TIMESTAMPTZ, NULL).
- `scrutinizedByAdminId` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Unique Constraint**: `UNIQUE (candidateId, electionId)`.
- **Index**: `CREATE INDEX idx_nominations_election_constituency ON candidate_nominations(electionId, status);`

---

### 2.5 Group E: Administrative Management & RBAC

#### Table: `admin_users`
ECI administrative officers.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `userId` (UUID, UNIQUE NOT NULL, FK -> `users.id` ON DELETE CASCADE).
- `officerCode` (VARCHAR(50), UNIQUE NOT NULL): (e.g. `'ECI-SUPER-001'`).
- `fullName` (VARCHAR(150), NOT NULL).
- `designation` (VARCHAR(150), NOT NULL).
- `role` (ENUM `AdminRole`, NOT NULL): `'SUPER_ADMIN'`, `'NATIONAL_ADMIN'`, `'STATE_ADMIN'`, `'ELECTION_OFFICER'`, or `'READ_ONLY_AUDITOR'`.
- `assignedStateId` (VARCHAR(10), NULL, FK -> `states.id` ON DELETE RESTRICT): Scope filter for `STATE_ADMIN` / `ELECTION_OFFICER`.
- `assignedElectionIds` (TEXT[], NOT NULL DEFAULT '{}'): Scope filter for `ELECTION_OFFICER`.
- `isActive` (BOOLEAN, NOT NULL DEFAULT TRUE).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).

#### Table: `admin_action_logs`
Sanitized, append-only administrative audit log.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `adminUserId` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL).
- `actionType` (VARCHAR(50), NOT NULL): (e.g. `'CREATE_ELECTION'`, `'UPDATE_SCHEDULE'`, `'ADVANCE_ROUND'`, `'PUBLISH_RESULT'`).
- `domain` (VARCHAR(50), NOT NULL): (e.g. `'ELECTION'`, `'CANDIDATE'`, `'RESULT'`).
- `targetEntityId` (VARCHAR(100), NOT NULL).
- `details` (JSONB, NOT NULL DEFAULT '{}'): Sanitized details (sensitive secrets, passwords, and OTPs redacted).
- `ipAddress` (VARCHAR(45), NULL).
- `timestamp` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- **Index**: `CREATE INDEX idx_admin_logs_target ON admin_action_logs(domain, targetEntityId, timestamp);`

---

### 2.6 Group F: Demo Participation Simulation (Strictly Decoupled)

#### Table: `demo_participations`
Voter demo participation tracking with zero candidate-choice storage.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `voterId` (UUID, NOT NULL, FK -> `voter_profiles.id` ON DELETE CASCADE).
- `electionId` (VARCHAR(50), NOT NULL, FK -> `elections.id` ON DELETE CASCADE).
- `status` (ENUM `ParticipationStatus`, NOT NULL DEFAULT `'VOTED'`).
- `demoReference` (VARCHAR(30), NOT NULL): Non-sensitive reference (e.g. `'DEMO-LS-000001'`).
- `referenceId` (VARCHAR(60), NOT NULL): Composite reference (e.g. `'DEMO-REF-LS2029-VOTER001'`).
- `participatedAt` (TIMESTAMPTZ, NOT NULL): Simulated event timestamp from centralized clock.
- `recordedAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()): Actual server execution timestamp.
- `metadata` (JSONB, NOT NULL DEFAULT '{}'): Sanitized non-choice metadata.
- **Unique Constraint**: `UNIQUE (voterId, electionId)`. Enforces one demo participation record per voter per election.
- **Index**: `CREATE INDEX idx_participations_lookup ON demo_participations(voterId, electionId);`

> **BALLOT SECRECY GUARANTEE**:
> This table contains **no** `candidateId`, `partyId`, or ballot choice column. Any attempt to add candidate selection columns to this table violates Rule 12 of the OVS Data Integrity Model.

---

### 2.7 Group G: Counting Simulation & Results (Independent Engine)

#### Table: `counting_sessions`
Independent deterministic constituency counting sessions.
- `id` (VARCHAR(100), PRIMARY KEY): Canonical session ID (e.g. `'RESULT-LS-2029-WB-PC-KOLKATA-SOUTH'`).
- `electionId` (VARCHAR(50), NOT NULL, FK -> `elections.id` ON DELETE CASCADE).
- `constituencyType` (ENUM `ConstituencyType`, NOT NULL).
- `parliamentaryConstituencyId` (VARCHAR(50), NULL, FK -> `parliamentary_constituencies.id` ON DELETE CASCADE).
- `assemblyConstituencyId` (VARCHAR(50), NULL, FK -> `assembly_constituencies.id` ON DELETE CASCADE).
- `totalConfiguredRounds` (INTEGER, NOT NULL DEFAULT 5).
- `currentRound` (INTEGER, NOT NULL DEFAULT 0).
- `status` (ENUM `ResultStatus`, NOT NULL DEFAULT `'DRAFT'`): Lifecycle state (`DRAFT`, `COUNTING_IN_PROGRESS`, `COUNTING_PAUSED`, `COUNTING_COMPLETED`, `RESULT_READY_FOR_REVIEW`, `PUBLISHED`, `TIED`, `CORRECTED`, etc.).
- `totalVoters` (INTEGER, NOT NULL): Sanctioned electorate for turnout calculation.
- `totalCountedVotes` (INTEGER, NOT NULL DEFAULT 0).
- `notaVotes` (INTEGER, NOT NULL DEFAULT 0).
- `rejectedVotes` (INTEGER, NOT NULL DEFAULT 0).
- `winnerCandidateId` (VARCHAR(50), NULL, FK -> `candidates.id` ON DELETE SET NULL).
- `runnerUpCandidateId` (VARCHAR(50), NULL, FK -> `candidates.id` ON DELETE SET NULL).
- `victoryMargin` (INTEGER, NOT NULL DEFAULT 0).
- `isPublished` (BOOLEAN, NOT NULL DEFAULT FALSE).
- `publishedAt` (TIMESTAMPTZ, NULL).
- `publishedByAdminId` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Unique Constraint**: `UNIQUE (electionId, parliamentaryConstituencyId, assemblyConstituencyId)`.
- **Index**: `CREATE INDEX idx_counting_sessions_pub ON counting_sessions(isPublished, electionId);`

#### Table: `counting_rounds`
Sequential round progression records.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `sessionId` (VARCHAR(100), NOT NULL, FK -> `counting_sessions.id` ON DELETE CASCADE).
- `roundNumber` (INTEGER, NOT NULL).
- `roundVotes` (INTEGER, NOT NULL DEFAULT 0).
- `cumulativeVotes` (INTEGER, NOT NULL DEFAULT 0).
- `leadingCandidateId` (VARCHAR(50), NULL, FK -> `candidates.id` ON DELETE SET NULL).
- `leadMargin` (INTEGER, NOT NULL DEFAULT 0).
- `processedAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- `processedByAdminId` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL).
- **Unique Constraint**: `UNIQUE (sessionId, roundNumber)`.
- **Index**: `CREATE INDEX idx_rounds_session ON counting_rounds(sessionId, roundNumber);`

#### Table: `candidate_tallies`
Independent candidate vote counts per counting session.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `sessionId` (VARCHAR(100), NOT NULL, FK -> `counting_sessions.id` ON DELETE CASCADE).
- `candidateId` (VARCHAR(50), NOT NULL, FK -> `candidates.id` ON DELETE CASCADE).
- `partyId` (VARCHAR(50), NOT NULL, FK -> `political_parties.id` ON DELETE RESTRICT).
- `votes` (INTEGER, NOT NULL DEFAULT 0).
- `voteSharePercentage` (NUMERIC(5, 2), NOT NULL DEFAULT 0.00).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Unique Constraint**: `UNIQUE (sessionId, candidateId)`.

#### Table: `result_correction_history`
Documented administrative audit trail for result revisions.
- `id` (UUID, PRIMARY KEY DEFAULT gen_random_uuid()).
- `sessionId` (VARCHAR(100), NOT NULL, FK -> `counting_sessions.id` ON DELETE CASCADE).
- `previousState` (JSONB, NOT NULL).
- `correctedState` (JSONB, NOT NULL).
- `reason` (TEXT, NOT NULL).
- `correctedByAdminId` (UUID, NOT NULL, FK -> `admin_users.id` ON DELETE RESTRICT).
- `correctedAt` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).

---

### 2.8 Group H: Announcements & Notifications

#### Table: `announcements`
Portal announcements issued by ECI administrators.
- `id` (VARCHAR(50), PRIMARY KEY): (e.g. `'ANN-001'`).
- `title` (VARCHAR(200), NOT NULL).
- `summary` (TEXT, NOT NULL).
- `message` (TEXT, NOT NULL).
- `category` (ENUM `AnnouncementCategory`, NOT NULL): `'GENERAL_INFO'`, `'ELECTION_SCHEDULE'`, `'POLLING_INSTRUCTIONS'`, `'RESULTS'`, `'IMPORTANT_NOTICE'`.
- `targetAudience` (ENUM `AnnouncementAudience`, NOT NULL DEFAULT `'ALL_VOTERS'`): `'ALL_VOTERS'`, `'SPECIFIC_STATE'`, `'SPECIFIC_ELECTION'`, `'SPECIFIC_CONSTITUENCY'`.
- `targetStateId` (VARCHAR(10), NULL, FK -> `states.id` ON DELETE SET NULL).
- `targetElectionId` (VARCHAR(50), NULL, FK -> `elections.id` ON DELETE SET NULL).
- `targetConstituencyId` (VARCHAR(50), NULL).
- `publicationDate` (DATE, NOT NULL).
- `expiryDate` (DATE, NOT NULL).
- `status` (ENUM `AnnouncementStatus`, NOT NULL DEFAULT `'PUBLISHED'`): `'DRAFT'`, `'PUBLISHED'`, `'ARCHIVED'`.
- `createdByAdminId` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL).
- `createdAt` / `updatedAt` (TIMESTAMPTZ).
- **Index**: `CREATE INDEX idx_announcements_audience ON announcements(status, targetAudience, publicationDate);`

#### Table: `voter_notifications`
Targeted notification feed for individual voter profiles.
- `id` (VARCHAR(50), PRIMARY KEY): (e.g. `'NOTIF-001'`).
- `voterId` (UUID, NOT NULL, FK -> `voter_profiles.id` ON DELETE CASCADE).
- `type` (ENUM `NotificationType`, NOT NULL): `'ELECTION_ANNOUNCEMENT'`, `'POLLING_SCHEDULE'`, `'ELECTION_REMINDER'`, `'RESULT_PUBLISHED'`, etc.
- `title` (VARCHAR(200), NOT NULL).
- `message` (TEXT, NOT NULL).
- `timestamp` (TIMESTAMPTZ, NOT NULL DEFAULT NOW()).
- `isRead` (BOOLEAN, NOT NULL DEFAULT FALSE).
- `readAt` (TIMESTAMPTZ, NULL).
- **Index**: `CREATE INDEX idx_notifications_voter_unread ON voter_notifications(voterId, isRead);`
