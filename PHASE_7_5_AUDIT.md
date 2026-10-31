# OVS Phase 7.5 Pre-Implementation Technical Audit (`PHASE_7_5_AUDIT.md`)

**Audit Date**: 2026-10-31  
**Target Scope**: Phase 7.5 Final Frontend Refinement, Bug Fixing & Verification  
**Architecture Constraint**: Frontend-Only Educational Prototype (No Backend, No Database, No External APIs)

---

## 1. Executive Summary of Codebase Inspection

A complete inspection of `/src`, `/tests`, `/package.json`, and project documentation (`README.md`, `ARCHITECTURE.md`, `TESTING.md`, `SECURITY-LIMITATIONS.md`, `plan.md`) was performed prior to making any code modifications.

### Current Strengths Verified
- **29 / 29 Automated Test Suites Passing** in `tests/electionArchitecture.test.mjs`.
- **Electoral Geography & Strict PC/AC Separation**: All 28 States and 8 Union Territories (36 jurisdictions) in `src/data/states.js`, Districts in `src/data/districts.js`, 72 Parliamentary Constituencies (`PARLIAMENTARY`) and 144 Assembly Constituencies (`ASSEMBLY`) in `src/data/constituencies.js`.
- **Context & Service Architecture**:
  - Contexts: `AuthContext.jsx`, `ElectionContext.jsx`, `VoterContext.jsx`, `NotificationContext.jsx`.
  - Services: `electionService.js`, `ballotValidationService.js`, `constituencyService.js`, `candidateService.js`, `adminPermissionService.js`, `countingService.js`, `dataIntegrityService.js`, `storageService.js`.

---

## 2. Discovered Issues & Root Causes

### Issue 1: Election Timeline & Demo Clock Inconsistency (Section 2)
- **Root Cause**:
  1. `src/data/elections.js` defines `LS-2029`, `WB-ASSEMBLY-2029`, and `DL-ASSEMBLY-2029` with 2029 calendar dates (`2029-04-10` to `2029-05-15`) and `status: 'POLLING_ACTIVE'`, while the host system date is in `2026`. Without a centralized Demo Simulation Clock (`DEMO_CLOCK_CONFIG`), comparing election dates against `new Date()` produces timeline mismatches.
  2. `validateElectionStatusTransition` in `src/services/adminPermissionService.js` checks status adjacency (`READY -> POLLING_ACTIVE`, `COUNTING -> RESULTS_DECLARED`) but does not validate schedule dates against the centralized demo clock (e.g., preventing `POLLING_ACTIVE` before `pollingStartDate`) or prevent `RESULTS_DECLARED` when counting sessions are still incomplete, unless an explicit `demoLifecycleOverride` flag is set.
  3. `transitionResultPublicationStatus` in `src/services/countingService.js` must strictly reject publishing any result record whose `countingStatus !== 'COMPLETED'` or `currentRound < totalConfiguredRounds` or `isTied === true`.
  4. `INITIAL_ELECTIONS` in `src/data/elections.js` needs explicit `demoTimelineMode: 'SIMULATED_CLOCK'` and `simulationClockDate` metadata, plus coverage for all 5 lifecycle archetypes (past election `LS-2024`, upcoming election `MH-ASSEMBLY-2029`, active simulated elections `LS-2029`/`WB-ASSEMBLY-2029`/`DL-ASSEMBLY-2029`, completed election, and election with unpublished results).

### Issue 2: Demo Ballot vs. Counting Separation Nuance (Section 3)
- **Root Cause**:
  1. While `completeDemoParticipationForCurrentVoter` in `VoterContext.jsx` calls `simulateElectionParticipationStatus` (which never stores candidate choices), `recordSimulatedParticipation` in `src/services/electionService.js` still accepted `selectedCandidateIdOrNota` and incremented a legacy `tallies` map (`${targetElectionId}::${resolvedConstituencyId}::${choice}`).
  2. Although `countingService.js` uses pre-seeded deterministic rounds in `INITIAL_RESULTS`, incrementing `tallies` inside `recordSimulatedParticipation` creates an implicit side-channel between a voter's ballot confirmation and a candidate tally counter.
  3. `BallotPage.jsx`, `BallotReview.jsx`, `DemoConfirmationModal.jsx`, and `DemoReceipt.jsx` should make it unmistakably clear that:
     - Candidate selection is strictly volatile in-memory UI state.
     - Confirming demo participation records **only** `status: 'VOTED'`, `participatedAt`, and `demoReference`.
     - Counting results in the Results Portal are independently simulated from demo counting datasets and never derived from individual voter ballot confirmations.

### Issue 3: Documentation Drift & Outdated File References (Section 4)
- **Root Cause**:
  1. `README.md`, `ARCHITECTURE.md`, `TESTING.md`, and `SECURITY-LIMITATIONS.md` contained references to nonexistent files (`src/data/indiaElectionSeed.js`, `src/context/ToastContext.jsx`, `src/components/election/`, `ovs_v3_0_participation`, `ovs_v3_0_votes`) instead of the actual files (`src/data/states.js`, `districts.js`, `constituencies.js`, `parties.js`, `elections.js`, `candidates.js`, `voters.js`, `results.js`, `src/context/NotificationContext.jsx`, `src/context/VoterContext.jsx`, `src/components/ballot/`, `src/components/voter/`, `src/components/results/`, `src/components/admin/`).
  2. `plan.md` still described the legacy pre-Phase-1 single-election prototype (`VotingContext.jsx`, `EciRegister.jsx`, `Vote.jsx`).

### Issue 4: Data Integrity Audit Completeness (Section 6)
- **Root Cause**:
  - `src/services/dataIntegrityService.js` implements 17 rules, but needs explicit checks for:
    - Voter participation records (`voter.elections[electionId]`) never containing `candidateId`, `selectedCandidateId`, `partyId`, `ballotChoice`, or `selectedOptionId` (privacy rule).
    - Impossible election lifecycle / schedule combinations and result publication before counting completion (`currentRound < totalConfiguredRounds` when `status === 'PUBLISHED'`).

### Issue 5: Linting Configuration & Browser E2E Verification (Sections 5 & 7)
- **Root Cause**:
  - `package.json` currently sets `"lint": "tsc --noEmit"` on a JSX codebase without a dedicated JSX/JS linter script or static code quality check, and lacks a browser-level E2E test script covering Scenarios A–G.

---

## 3. Planned Fixes (Execution Plan)

1. **Centralized Demo Clock & Timeline Validation (`src/utils/constants.js`, `src/services/adminPermissionService.js`, `src/services/countingService.js`, `src/data/elections.js`)**:
   - Define `DEMO_CLOCK_CONFIG` in `src/utils/constants.js` providing a centralized reference date (`2029-04-20T10:00:00.000Z` for active 2029 simulation window, configurable/overridable) and helper `getDemoNow(overrideDate)` so no component relies on scattered hardcoded dates.
   - Enhance `validateElectionStatusTransition` in `src/services/adminPermissionService.js` to block transitioning to `POLLING_ACTIVE` if the reference date is before `pollingStartDate` (unless `demoLifecycleOverride` is enabled) and block transitioning to `RESULTS_DECLARED` if counting is not completed.
   - Ensure `transitionResultPublicationStatus` in `src/services/countingService.js` blocks `PUBLISHED` whenever `currentRound < totalConfiguredRounds`, `countingStatus !== 'COMPLETED'`, or `isTied === true`.

2. **Strict Separation of Demo Ballot & Counting (`src/services/electionService.js`, `src/context/ElectionContext.jsx`, `src/pages/voter/BallotPage.jsx`, `src/components/ballot/BallotReview.jsx`)**:
   - Update `recordSimulatedParticipation` in `src/services/electionService.js` and `ElectionContext.jsx` so that voter participation never writes candidate selections to any persistent store or links voter participation to candidate vote counts.
   - Clear temporary selection state immediately upon confirmation, cancellation, election switch, or unmount.
   - Enhance UI notices on `BallotPage.jsx` and `BallotReview.jsx` to explicitly state that counting results are simulated independently using demo counting datasets.

3. **Data Integrity Service Enhancement (`src/services/dataIntegrityService.js`)**:
   - Audit and strengthen all 17 rules in `src/services/dataIntegrityService.js` so they validate:
     - All foreign-key references across States, Districts, PCs, ACs, Parties, Elections, Candidates, Voters, and Results.
     - Zero candidate-choice leakage in `voter.elections` participation records.
     - Impossible election lifecycle states and premature result publication (`PUBLISHED` before `currentRound === totalConfiguredRounds`).

4. **Documentation Synchronization (`README.md`, `ARCHITECTURE.md`, `TESTING.md`, `SECURITY-LIMITATIONS.md`, `plan.md`)**:
   - Rewrite all 5 documentation files to accurately reflect the exact file paths, context providers, services, datasets, storage keys, simultaneous election workflows, counting separation, and frontend-only security boundaries.

5. **Linting, Automated Unit/Integration Tests, and E2E Browser Verification (`tests/electionArchitecture.test.mjs`, `tests/e2e.spec.mjs`)**:
   - Add comprehensive automated tests for timeline lifecycle enforcement, demo clock modes (past, upcoming, active, completed, unpublished results), strict ballot-to-counting separation, and all 17 integrity rules.
   - Configure and execute verification (`npm test`, `npm run lint`, `npm run build`, and E2E verification).
