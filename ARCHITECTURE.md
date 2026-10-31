# OVS Architecture & Electoral Domain Model

> **FRONTEND PROTOTYPE BOUNDARY**
> All state management, persistence, RBAC checks, ballot workflows, and round-by-round counting simulations execute strictly in the browser using React 19, React Router 7, and versioned `localStorage` (`ovs_v3_0_*`). No backend server, database, or external API is used.

---

## 1. Layered Frontend Architecture

### 1.1 Context Providers (`src/context/`)
The application wraps `AppRoutes` in four React Context providers (defined in `src/App.jsx`):
1. **`NotificationContext.jsx`**: Ephemeral UI toast notifications (`notify.success`, `notify.error`, `notify.info`, `notify.warning`).
2. **`ElectionContext.jsx`**: Master domain store synchronizing states, districts, constituencies, political parties, elections, candidates, voters, announcements, voter notifications, append-only audit logs, counting sessions (`results`), and live 17-rule data integrity reports (`dataIntegrityReport`).
3. **`AuthContext.jsx`**: Manages simulated OTP challenges (`createSimulatedOtpChallenge`, `verifySimulatedOtpChallenge`), voter sessions, and ECI admin officer sessions with 8-hour expiry (`OTP_CONFIG.SESSION_DURATION_MS`).
4. **`VoterContext.jsx`**: Provides voter-scoped selectors and actions for the currently authenticated voter (`currentVoter`, `eligibleElections`, `simultaneousActiveElections`, `participationSummary`, `voterNotifications`, `markElectionParticipated`).

### 1.2 Domain Services (`src/services/`)
All business logic is extracted into pure, unit-tested ES module services:
- **`storageService.js`**: Durable `localStorage` persistence with schema version check (`STORAGE_VERSION = 'ovs_v3_0'`), safe JSON parsing, automatic self-healing recovery from corrupted storage (`getDurableItem`), and `resetAllDemoData()`.
- **`electionService.js`**: Creates/updates election records (`createElectionRecord`, `updateElectionRecord`), generates non-sensitive participation references (`generateNonSensitiveDemoReference`), and records voter participation (`recordSimulatedParticipation`) using the centralized demo clock (`getDemoReferenceIso`) with strict ballot-to-counting separation.
- **`constituencyService.js`**: Validates and manages `PARLIAMENTARY` and `ASSEMBLY` constituencies (`createConstituencyRecord`, `updateConstituencyRecord`).
- **`candidateService.js`**: Enforces election-to-constituency type matching (`LOK_SABHA` -> `PARLIAMENTARY`, `STATE_ASSEMBLY` -> `ASSEMBLY`) and state matching during candidate creation/editing.
- **`ballotValidationService.js`**: Implements the 8-point pre-ballot eligibility & status validator (`validateBallotAccess`), candidate search/filter/sort (`filterAndSortBallotCandidates`), and volatile in-memory selection resolution (`resolveTemporaryBallotSelection`).
- **`adminPermissionService.js`**: Enforces the 5-role RBAC route matrix (`canAdminAccessRoute`), action scope checks (`canAdminPerformAction`), election lifecycle transitions (`validateElectionStatusTransition`), timeline consistency validation (`validateElectionTimelineConsistency`), 8+ milestone schedule chronology (`validateElectionSchedule`), schedule conflict detection (`detectScheduleConflicts`), and sanitized audit logging (`createSanitizedAuditLogEntry`).
- **`countingService.js`**: Deterministic FNV-1a round-by-round counting engine (`createCountingSession`, `startCountingSession`, `processNextCountingRound`, `pauseCountingSession`, `resumeCountingSession`, `completeCountingSession`, `resetCountingSession`, `transitionResultPublicationStatus`, `applyAdminResultCorrection`), 12-rule result validator (`validateResultRecord`), public visibility filter (`getPubliclyVisibleResults`), analytics engines (`computeLokSabhaNationalAnalytics`, `computeStateAssemblyAnalytics`, `computePartyWiseAnalytics`, `computeSimultaneousElectionOverview`), and RFC-4180 CSV exporters.
- **`dataIntegrityService.js`**: Runs 17 automated relational, geographic, chronological, ballot-privacy, counting-completion, and provenance rules (`auditElectionDataIntegrity`), using centralized `getDemoReferenceDate` and `isValidIsoDateString` from `src/utils/constants.js` with zero hardcoded fallback dates.

### 1.3 Seeded Data Layer (`src/data/`)
- **`states.js`**: 28 States + 8 Union Territories (`METADATA_SOURCES.VERIFIED_OFFICIAL`).
- **`districts.js`**: 72 representative districts across all 36 jurisdictions.
- **`constituencies.js`**: 72 Parliamentary Constituencies (`PARLIAMENTARY`) + 144 Assembly Constituencies (`ASSEMBLY`) with `parentParliamentaryConstituencyId` mappings.
- **`parties.js`**: National, State, and Independent political party records (`PARTY-BJP`, `PARTY-INC`, `PARTY-AITC`, `PARTY-AAP`, `PARTY-DMK`, `PARTY-SP`, `PARTY-IND`, etc.).
- **`elections.js`**: 5 seeded elections (`LS-2029`, `WB-ASSEMBLY-2029`, `DL-ASSEMBLY-2029`, `MH-ASSEMBLY-2029`, `LS-2024`) and 3 portal announcements (`INITIAL_ANNOUNCEMENTS`).
- **`candidates.js`**: Contesting candidate profiles mapped to specific `(electionId, constituencyId)` pairs, plus baseline `INITIAL_TALLIES`.
- **`voters.js`**: 6 multi-state demo voters (`VOTER-001` through `VOTER-006`), 5 ECI admin officers (`INITIAL_ADMIN_OFFICERS`), 8 voter notifications (`INITIAL_VOTER_NOTIFICATIONS`), and initial audit logs (`INITIAL_AUDIT_LOGS`).
- **`results.js`**: Seeded constituency counting and result records (`INITIAL_RESULTS`) covering published, counting-in-progress, and ready-for-review states.

---

## 2. Centralized Demo Clock & Election Lifecycle Rules

### 2.1 Centralized Reference Clock (`DEMO_CLOCK_CONFIG`)
Defined in `src/utils/constants.js`:
- `referenceDate`: `'2029-04-20'`
- `referenceTimestamp`: `'2029-04-20T10:30:00.000Z'`
- `simulationMode`: `'SIMULATED_ELECTION_TIMELINE'`
- `sandboxConcurrencyMode`: `'CONCURRENT_SIMULATION_SANDBOX'`
- Helper APIs: `getDemoReferenceDate()`, `getDemoReferenceIso()`, `isValidIsoDateString()`, `isValidIsoTimestamp()`, `setDemoClockConfig()`, and `resetDemoClockConfig()`.
- **Participation vs. System Timestamp Separation**:
  - `participatedAt`: Derived from the centralized demo clock (`getDemoReferenceIso(electionClockOverride || DEMO_CLOCK_CONFIG.referenceTimestamp)`), ensuring participation timestamps always fall within the active `2029` simulated election window rather than the host machine's wall-clock year.
  - `recordedAt`: Represents the actual runtime wall-clock timestamp (`new Date().toISOString()`). By default, `recordedAt` is returned only in the transient service response (`recordSimulatedParticipation`) and omitted from persisted `voter.elections[electionId]` records unless `includeSystemTimestamp: true` is explicitly passed.

### 2.2 Supported Election Lifecycle States & Seeded Scenarios
| Election ID | Type | State | Status | Polling Window | Purpose in Simulation |
| :--- | :--- | :--- | :--- :--- | :--- | :--- |
| `LS-2024` | `LOK_SABHA` | All India | `RESULTS_DECLARED` | `2024-04-19` to `2024-06-01` | Past completed election with historical declared results |
| `LS-2029` | `LOK_SABHA` | All India | `POLLING_ACTIVE` | `2029-04-10` to `2029-05-15` | Active nationwide Lok Sabha polling + concurrent counting demo |
| `WB-ASSEMBLY-2029` | `STATE_ASSEMBLY` | `WB` | `POLLING_ACTIVE` | `2029-04-12` to `2029-05-10` | Active simultaneous State Assembly election for West Bengal |
| `DL-ASSEMBLY-2029` | `STATE_ASSEMBLY` | `DL` | `POLLING_ACTIVE` | `2029-04-15` to `2029-05-05` | Active simultaneous State Assembly election for NCT of Delhi |
| `MH-ASSEMBLY-2029` | `STATE_ASSEMBLY` | `MH` | `UPCOMING` | `2029-09-10` to `2029-09-25` | Upcoming scheduled election (blocked from `POLLING_ACTIVE` before `2029-09-10`) |

### 2.3 Timeline & Transition Enforcement
1. **Chronological Schedule Order**: `registrationDeadline <= pollingStartDate` and `nominationStartDate <= nominationEndDate <= scrutinyDate <= withdrawalDeadline <= campaignStartDate <= campaignEndDate <= pollingStartDate <= pollingEndDate <= countingDate <= resultDate`.
2. **Pre-Polling Guard**: `validateElectionStatusTransition` blocks transitioning an election to `POLLING_ACTIVE` when `referenceDate < pollingStartDate` (unless `demoLifecycleOverride` is explicitly enabled).
3. **Result Publication Guard**: `transitionResultPublicationStatus` blocks transitioning a constituency result to `PUBLISHED` unless `countingStatus === 'COMPLETED'` and all configured counting rounds (`rounds.length >= totalConfiguredRounds`) have been processed.
4. **Declaration Guard**: `validateElectionStatusTransition` blocks transitioning an election to `RESULTS_DECLARED` if any associated constituency counting session is incomplete or tied.

---

## 3. Strict Separation of Demo Ballot & Counting Engine

```text
┌──────────────────────────────────────────────────────────┐
│            VOTER BALLOT WORKFLOW (/voter/*)              │
│  1. Select Candidate or NOTA in volatile React useState  │
│  2. Review temporary selection in BallotReview.jsx       │
│  3. Confirm in DemoConfirmationModal.jsx                 │
│  4. recordSimulatedParticipation() updates ONLY:         │
│     voter.elections[electionId] = {                      │
│       status: 'VOTED',                                   │
│       participated: true,                                │
│       participatedAt: getDemoReferenceIso(),             │
│       demoReference: 'DEMO-LS-000001',                   │
│       referenceId: 'DEMO-REF-LS2029-VOTER001'            │
│     }                                                    │
│  5. Candidate selection is immediately discarded!        │
└──────────────────────────────────────────────────────────┘
                         ║
          ZERO DATA LINK ║ (Strictly Decoupled)
                         ║
┌──────────────────────────────────────────────────────────┐
│         COUNTING SIMULATION ENGINE (/eci/results)        │
│  1. Uses INITIAL_RESULTS & deterministic FNV-1a hashes   │
│  2. Processes sequential rounds (Round 1..N)             │
│  3. Computes leading candidate, winner, runner-up,       │
│     victory margin, NOTA share, and ties                 │
│  4. Publishes verified results to /results               │
└──────────────────────────────────────────────────────────┘
```
