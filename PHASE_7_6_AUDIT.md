# OVS – Phase 7.6 Pre-Implementation Audit Report

**Project**: Online Voting System (OVS) — Educational Frontend Prototype  
**Phase**: Phase 7.6 — Final Verification Patch  
**Audit Scope**: Full codebase, documentation, `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`, `src/services/electionService.js`, `src/services/dataIntegrityService.js`, `src/utils/constants.js`, and existing test infrastructure (`tests/`).

---

## 1. Executive Summary

Prior to applying Phase 7.6 stabilization patches, a comprehensive audit of the OVS React frontend repository and existing Phase 1–7.5 deliverables (`README.md`, `ARCHITECTURE.md`, `TESTING.md`, `SECURITY-LIMITATIONS.md`, `PHASE_7_5_FINAL_REPORT.md`, `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`) was conducted.

All **32 Node.js unit and integration tests** (`npm test`) and the **Vite 8 production build** (`npm run build`) pass. However, four concrete stabilization and verification gaps were verified in the codebase:

1. **Voter Participation Timestamp Inconsistency (`src/services/electionService.js`)**: `recordSimulatedParticipation` uses the real system clock (`new Date().toISOString()`) instead of the centralized simulated demo clock (`DEMO_CLOCK_CONFIG.referenceTimestamp` / `getDemoReferenceIso`) for `participatedAt`.
2. **Residual Hardcoded Demo Clock Fallback (`src/services/dataIntegrityService.js`)**: Rule 13 schedule/status auditing still contains a hardcoded `'2029-04-20'` fallback (`const refClock = el.simulationClockDate || '2029-04-20';`) instead of reading from `src/utils/constants.js`.
3. **Absence of Browser-Based E2E Playwright Suite (`tests/e2e/`)**: While 32 service-level and architectural tests exist in `tests/electionArchitecture.test.mjs`, there is no `playwright.config.js` or `tests/e2e/*.spec.js` suite verifying rendered browser workflows across public, voter, ballot, privacy, admin, counting, and data recovery journeys.
4. **Build Config Deprecation & Script Labeling Clarity (`vite.config.ts`, `package.json`)**:
   - `vite.config.ts` line 11 uses `__dirname` inside an ESM context, triggering a Vite 8 Rolldown warning (`Use import.meta.dirname instead`).
   - `package.json` maps `"lint": "tsc --noEmit"` without an explicit `"typecheck"` script, which previously led documentation to conflate TypeScript compiler verification with ESLint.

---

## 2. Detailed Findings by Audit Area

### 2.1 Participation Timestamp Behavior (`src/services/electionService.js`)
- **Location**: `src/services/electionService.js` lines 208–225 (`recordSimulatedParticipation`).
- **Observed Code**:
  ```js
  const referenceId = generateParticipationReference(targetElectionId);
  const participatedAt = new Date().toISOString();
  ```
- **Verified Issue**:
  - While the rest of the simulation operates on the deterministic demo reference clock (`2029-04-20T10:30:00.000Z` defined in `DEMO_CLOCK_CONFIG` in `src/utils/constants.js`), recording voter participation stamps `participatedAt` with the host machine's real wall-clock timestamp (e.g., `2026-...`).
  - Furthermore, there is no separation between the simulated election event timestamp (`participatedAt`) and the actual system recording timestamp (`recordedAt`).
- **Required Fix**:
  - Compute `participatedAt` using `getDemoReferenceIso(simulatedTimestamp || election?.simulationTimestamp || (election?.simulationClockDate ? `${election.simulationClockDate}T10:30:00.000Z` : null))`.
  - Compute `recordedAt = new Date().toISOString()` as a distinct system diagnostic timestamp on the return payload (and only attach `recordedAt` inside the persisted voter election record when explicitly requested via `includeSystemTimestamp: true`, preserving the strict 5-key voter-facing schema `['demoReference', 'participated', 'participatedAt', 'referenceId', 'status']` verified by Phase 7.5).

### 2.2 Residual Hardcoded Demo Clock Fallback (`src/services/dataIntegrityService.js`)
- **Location**: `src/services/dataIntegrityService.js` line 533 (`auditElectionDataIntegrity`, Rule 13).
- **Observed Code**:
  ```js
  const pollDate = el.schedule?.pollingDate || el.pollingDate;
  const countDate = el.schedule?.countingDate || el.countingDate;
  const refClock = el.simulationClockDate || '2029-04-20';
  ```
- **Verified Issue**:
  - `src/services/dataIntegrityService.js` does not import `DEMO_CLOCK_CONFIG` or `getDemoReferenceDate` from `src/utils/constants.js`.
  - If `DEMO_CLOCK_CONFIG.referenceDate` is updated in `src/utils/constants.js`, `auditElectionDataIntegrity` still falls back to the hardcoded `'2029-04-20'` literal when `el.simulationClockDate` is absent.
  - Additionally, if `el.simulationClockDate` contains a malformed date string (e.g., `'invalid-date'`), Rule 13 performs string comparison without flagging an invalid simulation clock date or falling back safely.
- **Required Fix**:
  - Import `DEMO_CLOCK_CONFIG`, `getDemoReferenceDate`, and `isValidIsoDateString` from `../utils/constants`.
  - Validate `el.simulationClockDate` when present (logging an explicit Rule 13 schedule/clock error if invalid) and resolve `refClock` exclusively via `getDemoReferenceDate(validElectionClock || options.referenceDate)`.

### 2.3 Centralized Demo Clock Utilities (`src/utils/constants.js`)
- **Location**: `src/utils/constants.js` lines 155–183 (`DEMO_CLOCK_CONFIG`, `getDemoReferenceDate`, `getDemoReferenceIso`).
- **Observed Behavior**:
  - `DEMO_CLOCK_CONFIG` is currently `Object.freeze({...})`, which prevents runtime or test-time clock overrides on `DEMO_CLOCK_CONFIG` directly unless custom arguments or a setter utility (`setDemoClockConfig` / `resetDemoClockConfig`) are provided.
- **Required Fix**:
  - Provide `isValidIsoDateString(value)`, `isValidIsoTimestamp(value)`, `setDemoClockConfig(overrides)`, and `resetDemoClockConfig()` alongside `DEMO_CLOCK_CONFIG`, `getDemoReferenceDate`, and `getDemoReferenceIso` so both application code and automated tests can deterministically inspect or shift the demo clock and verify downstream effects across `electionService.js` and `dataIntegrityService.js`.

### 2.4 Dependencies, Lockfile & Build Configuration (`package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json`)
- **Lockfile & Package Manager**:
  - `package.json` and `bun.lock` are present in the project root, with `node_modules` installed.
- **Vite Configuration (`vite.config.ts`)**:
  - Line 11 uses `path.resolve(__dirname, '.')`, which emits a Rolldown/Vite 8 deprecation notice during `npm run build`: `Use import.meta.dirname instead`.
- **Scripts (`package.json`)**:
  - Currently defines `"lint": "tsc --noEmit"` and `"test": "node --import ./tests/loader.mjs --test tests/electionArchitecture.test.mjs"`.
  - Adding explicit `"typecheck": "tsc --noEmit"`, `"test:unit"`, and `"test:e2e": "playwright test"` scripts clarifies the distinction between TypeScript static type validation, Node.js unit/integration tests, and Playwright E2E browser tests.

### 2.5 End-to-End Browser Verification (`tests/e2e/`)
- **Current State**:
  - Only `tests/electionArchitecture.test.mjs` and `tests/loader.mjs` exist.
- **Required Action**:
  - Install `@playwright/test`, create `playwright.config.js`, and implement 11 modular Playwright E2E spec files under `tests/e2e/` covering Requirements A through J:
    1. `tests/e2e/public-portal.spec.js`
    2. `tests/e2e/voter-registration.spec.js`
    3. `tests/e2e/voter-authentication.spec.js`
    4. `tests/e2e/lok-sabha-ballot.spec.js`
    5. `tests/e2e/assembly-ballot.spec.js`
    6. `tests/e2e/simultaneous-elections.spec.js`
    7. `tests/e2e/candidate-choice-privacy.spec.js`
    8. `tests/e2e/admin-election-management.spec.js`
    9. `tests/e2e/candidate-management.spec.js`
    10. `tests/e2e/counting-results.spec.js`
    11. `tests/e2e/data-integrity.spec.js` & `tests/e2e/recovery-reset.spec.js`
