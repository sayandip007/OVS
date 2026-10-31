# OVS Testing, Verification & Quality Assurance Guide

This document details the automated Node.js unit/integration test suites, real Chromium browser End-to-End (E2E) Playwright test suites, TypeScript static typechecking, and production build validations for the Online Voting System (OVS) frontend prototype.

---

## 1. Verification Commands

| Check | Command | Target / Scope |
| :--- | :--- | :--- |
| **Node.js Unit & Integration Tests** | `npm test` (or `npm run test:unit`) | Runs `node --import ./tests/loader.mjs --test tests/electionArchitecture.test.mjs` (**35 comprehensive test suites**) |
| **Real Browser E2E Tests (Playwright)** | `npm run test:e2e` (or `npx playwright test`) | Runs **12 real Chromium browser E2E test suites** in `tests/e2e/*.spec.js` against `http://localhost:3000` |
| **TypeScript Static Typecheck** | `npm run typecheck` (alias: `npm run lint`) | Runs `tsc --noEmit` to verify project TypeScript configuration (`tsconfig.json` & `vite.config.ts`) |
| **Production Bundle Build** | `npm run build` | Runs `vite build` (`vite v8.3.5`) to verify zero unresolved imports, deprecation warnings, or bundle errors |

> **Clarification on `npm run typecheck` vs `npm run lint`**:
> `package.json` defines `"typecheck": "tsc --noEmit"` and `"lint": "tsc --noEmit"` for backward compatibility. It executes the TypeScript compiler in check-only mode (`tsc --noEmit`) rather than ESLint.

---

## 2. Automated Node.js Test Suite Coverage (`tests/electionArchitecture.test.mjs`)

The automated Node.js test runner (`tests/electionArchitecture.test.mjs`) executes **35 test suites** covering Phases 1 through 7.6:

### Phases 1 & 2 — Core Geography & Election Architecture
1. **Routing, Navigation, 36 States/UTs, PC/AC Separation, and Election Creation**:
   - Verifies all public, voter, and ECI admin routes in `src/routes/AppRoutes.jsx`.
   - Verifies 28 States + 8 Union Territories = 36 jurisdictions in `src/data/states.js`.
   - Verifies 72 Parliamentary Constituencies (`PARLIAMENTARY`) and 144 Assembly Constituencies (`ASSEMBLY`) in `src/data/constituencies.js`.
   - Verifies that Lok Sabha candidates cannot be assigned to Assembly constituencies.

### Phase 3 — Complete Voter Portal
2. **Registration Validation (Scenarios 1–10)**: Valid registration, underage (<18) rejection, invalid 10-digit Indian mobile rejection, invalid email/PIN rejection, cascading State -> District -> PC -> AC filtering, parent state change reset, and duplicate EPIC prevention.
3. **Authentication & OTP Simulation (Scenarios 11–17)**: Sample voters across `WB`, `MH`, `UP`, `TN`, `DL`; primary OTP `123456`; resend OTP `654321`; 3 max attempts; 120s expiry.
4. **Voter Profile Management (Scenarios 18–20)**: Profile completion calculation, personal field validation, and locked constituency association unless `allowAdminConstituencyCorrection` is enabled.
5. **Constituency Explorer (Scenarios 21–24)**: Distinct Parliamentary and Assembly constituency cards, parent PC linkage, and contesting candidate lists.
6. **Election Eligibility Matching (Scenarios 25–30)**: Simultaneous eligibility (`LS-2029` + `WB-ASSEMBLY-2029`), cross-state isolation (`WB` voter blocked from `DL-ASSEMBLY-2029`), upcoming status (`MH-ASSEMBLY-2029`), and historical voted status (`LS-2024`).
7. **Independent Participation Status (Scenarios 31–33)**: Completing `LS-2029` marks only `LS-2029` as `VOTED`, leaves `WB-ASSEMBLY-2029` as `PENDING`, and omits `candidateId`/`partyId`.
8. **Voter Notifications (Scenarios 34–36)**: All 8 notification categories in `INITIAL_VOTER_NOTIFICATIONS` and read/unread state management.
9. **Persistence & Voter Layout (Scenarios 37–40)**: `localStorage` persistence (`ovs_v3_0_*`), `resetAllDemoData()`, and all 10 `VoterLayout.jsx` navigation links.

### Phase 4 — Election Ballot & Voting Experience
10. **Candidate Filtering & Ballot Tools**: Strict separation of Lok Sabha and State Assembly candidates, zero candidate overlap, search/party filter, and alphabetical sorting.
11. **Volatile In-Memory Ballot Selection**: Single option selection, changing selection, clearing selection, `NOTA_OPTION` selection, and cross-ballot candidate rejection.
12. **Pre-Ballot Validation & Status Explanations**: All 8 validation rules (`UNAUTHENTICATED`, `ELECTION_NOT_FOUND`, `STATE_MISMATCH`, `ELECTION_NOT_ACTIVE`, `ELECTION_CLOSED`, `ELECTION_CANCELLED`, `ALREADY_PARTICIPATED`) and 10 status explanations.
13. **Simultaneous Elections (Scenarios A–G)**: Completing Lok Sabha first (`1/2`), duplicate submission blocking, completing State Assembly second (`2/2`), completing Assembly first, Lok Sabha-only voter (`UP`), and statutory ballot banners.

### Phase 5 — ECI Administration Portal
14. **Admin Authentication & RBAC Permissions**: 5 admin roles (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`, `READ_ONLY_AUDITOR`), route guards, and state/election scope enforcement.
15. **Election Lifecycle & Validation**: Duplicate election ID rejection, missing state rejection for Assembly elections, PC/AC type mismatch rejection, and status transition guards.
16. **Constituencies, Parties & Candidate Scrutiny**: Constituency modification impact warnings, party deletion protection when referenced by candidates, and exclusion of `REJECTED`/`SUSPENDED`/`WITHDRAWN` candidates from ballots.
17. **Schedules, Announcements, Privacy & Audit Logs**: 8-milestone schedule chronology validation, simultaneous schedule overlap detection, sanitized append-only audit logs, and all 16 admin route paths.

### Phase 6 — Election Counting, Results Management & Analytics
18. **Result Validation Rules (Tests 1–8)**: Valid session creation, invalid election/constituency rejection, cross-election/cross-constituency candidate rejection, negative/float vote rejection, and configured vote limit enforcement.
19. **Counting Engine & Standings (Tests 9–20)**: Sequential round processing, interim leading candidate without premature winner declaration, pause/resume guards, duplicate round rejection, winner/runner-up/margin calculation, and tie detection (`RESULT_STATUSES.TIED`).
20. **Election Separation & Simultaneous Independence (Tests 21–25)**: Independent Lok Sabha national analytics, State Assembly analytics, simultaneous PC + AC result overview, and cross-state isolation.
21. **Party Analytics, Turnout & NOTA (Tests 26–31)**: Party seat counts, vote share percentages, NOTA share tracking (never winning a seat), Independent candidate handling, and turnout metrics.
22. **Publication Workflow, Admin Corrections, CSV Export & Persistence (Tests 32–40)**: Draft/unpublished result hiding from public views, `PUBLISHED` transition, documented administrative correction with `correctionHistory`, CSV export formatting, and `localStorage` persistence.

### Phase 7 & 7.5 — Data Integrity, Security Hardening, Timeline & Counting Separation
23–29. **Phase 7 Audits**: 17-rule `auditElectionDataIntegrity` verification, provenance labeling (`VERIFIED_OFFICIAL` vs `DEMO_SAMPLE`), XSS/CSV/URL sanitization, accessibility semantics, and documentation presence.
30. **Phase 7.5.1 — Centralized Demo Clock & Election Timeline Validation**:
    - Verifies `DEMO_CLOCK_CONFIG` (`referenceDate: '2029-04-20'`).
    - Verifies timeline consistency across past (`LS-2024`), active simulated (`LS-2029`, `WB-ASSEMBLY-2029`, `DL-ASSEMBLY-2029`), upcoming (`MH-ASSEMBLY-2029`), and unpublished result records.
    - Verifies that an election cannot enter `POLLING_ACTIVE` before its `pollingStartDate` (`MH-ASSEMBLY-2029` blocked on `2029-04-20`).
    - Verifies that a result cannot be `PUBLISHED` before all configured counting rounds are completed.
    - Verifies that an election cannot transition to `RESULTS_DECLARED` while counting sessions are incomplete or tied.
31. **Phase 7.5.2 — Strict Ballot-to-Counting Separation & Zero Candidate-Choice Persistence**:
    - Verifies that `recordSimulatedParticipation` returns `ballotCountingSeparation: 'STRICT_DECOUPLED'` and leaves `tallies` 100% unchanged even if a candidate ID or NOTA is passed.
    - Verifies that `voter.elections[electionId]`, `localStorage`, audit logs, notifications, and `DemoReceipt.jsx` contain zero candidate/party choice fields.
    - Verifies that `BallotReview.jsx`, `DemoConfirmationModal.jsx`, and `DemoReceipt.jsx` explicitly state that counting results are independently simulated using demo datasets.
32. **Phase 7.5.3 — End-to-End User Journey Simulations (Scenarios A–G) & Documentation Path Verification**:
    - Programmatically executes Scenarios A through G (Public Portal -> Voter Registration/Login -> Simultaneous Lok Sabha & Assembly Ballots -> Admin RBAC & Counting Simulation -> Reset & Corruption Recovery).
    - Parses `README.md`, `ARCHITECTURE.md`, `TESTING.md`, `SECURITY-LIMITATIONS.md`, and `plan.md` and verifies that every `src/...` path referenced in documentation exists on disk.

### Phase 7.6 — Participation Timestamp Consistency & Centralized Demo Clock Verification
33. **Phase 7.6.1 — Participation Timestamp Uses Centralized Demo Clock (`DEMO_CLOCK_CONFIG`)**:
    - Verifies default `participatedAt` equals `2029-04-20T10:30:00.000Z` (`DEMO_CLOCK_CONFIG.referenceTimestamp`).
    - Verifies runtime updates via `setDemoClockConfig` (`2029-05-12T14:15:00.000Z`) propagate to `recordSimulatedParticipation`.
    - Verifies custom per-election `simulationClockDate` (`2029-04-25`) resolves to `2029-04-25T10:30:00.000Z`.
34. **Phase 7.6.2 — Separation of Simulated `participatedAt` vs System `recordedAt` & Zero Candidate Choice**:
    - Verifies `recordedAt` is omitted from voter-facing `voter.elections[electionId]` by default, included only when `includeSystemTimestamp: true` is passed, and that forbidden candidate/party keys (`candidateId`, `partyId`, `selectedCandidateId`, `ballotChoice`) are never stored.
35. **Phase 7.6.3 — Data Integrity Service Uses Centralized Demo Clock Without Hardcoded Fallbacks**:
    - Verifies `src/services/dataIntegrityService.js` contains zero hardcoded `'2029-04-20'` literals, flags malformed `simulationClockDate` values, and respects updated `DEMO_CLOCK_CONFIG` dates.

---

## 3. Real Browser E2E Test Suite (`playwright.config.js` & `tests/e2e/`)

Playwright (`@playwright/test`) runs **12 real headless Chromium browser test suites** against the live application on `http://localhost:3000`:

| Spec File | Requirement Covered | Key Browser Assertions |
| :--- | :--- | :--- |
| `tests/e2e/public-portal.spec.js` | **A. Public Portal** | Home page, educational prototype disclaimer, Election Information, Candidate Directory filters, Results Hub, Lok Sabha & Assembly results, Constituency Result detail, Feedback form submission |
| `tests/e2e/voter-registration.spec.js` | **B. Voter Registration** | Invalid underage/mobile rejection, cascading `WB` -> `DIST-WB-KOL` -> `PC-WB-KOLKATA-SOUTH` -> `AC-WB-BHABANIPUR` selection, registration completion (`WBX4455667`), duplicate EPIC rejection |
| `tests/e2e/voter-authentication.spec.js` | **C. Voter Authentication** | Invalid EPIC/mobile error, wrong OTP rejection, valid login with OTP `123456`, Voter Dashboard dual-constituency cards, logout and route guard protection |
| `tests/e2e/lok-sabha-ballot.spec.js` | **D. Lok Sabha Ballot** | `/voter/elections/LS-2029/ballot`, PC candidate cards + NOTA, Candidate Profile modal, Ballot Review, Demo Confirmation modal, Receipt (`DEMO-LS-...`), duplicate ballot prevention |
| `tests/e2e/assembly-ballot.spec.js` | **E. State Assembly Ballot** | `/voter/elections/WB-ASSEMBLY-2029/ballot`, AC candidate cards + NOTA, Ballot Review, Demo Confirmation modal, Receipt (`DEMO-ASM-...`), duplicate ballot prevention |
| `tests/e2e/simultaneous-elections.spec.js` | **F. Simultaneous Elections** | Logs in as `WBX1234567`, verifies both `LS-2029` and `WB-ASSEMBLY-2029` start `PENDING`, completes `LS-2029`, verifies `WB-ASSEMBLY-2029` remains `PENDING`, then completes `WB-ASSEMBLY-2029` (`2/2`) |
| `tests/e2e/candidate-choice-privacy.spec.js` | **G. Candidate Choice Privacy** | Completes ballot in real browser, inspects `localStorage` (`ovs_v3_0_voters`, `ovs_v3_0_tallies`, `ovs_v3_0_results`, `ovs_v3_0_audit_logs`), verifies zero candidate/party choice keys and `2029-04-20` demo timestamp |
| `tests/e2e/admin-election-management.spec.js` | **H. Admin Portal & RBAC** | `SUPER_ADMIN` login (`ECI-SUPER-001` / `admin123` / `123456`), Election Management, Schedule validation, Monitoring, Announcements, Audit Logs, and `READ_ONLY_AUDITOR` write-restriction enforcement |
| `tests/e2e/candidate-management.spec.js` | **H. Candidate Scrutiny** | Candidate Management table, PC/AC type validation rules, nomination status filtering |
| `tests/e2e/counting-results.spec.js` | **I. Counting & Results** | Starts/advances round-by-round counting on `/eci/results`, verifies unpublished results stay hidden on `/results`, publishes completed result, verifies public visibility |
| `tests/e2e/data-integrity.spec.js` | **J. Data Integrity Audit** | Navigates to `/eci/settings`, verifies 17-rule Data Integrity Audit passes with 0 errors and displays centralized demo clock (`2029-04-20`) |
| `tests/e2e/recovery-reset.spec.js` | **J. Recovery & Reset** | Mutates `localStorage`, triggers Reset Demo Data in UI, injects corrupted JSON into `ovs_v3_0_voters` and `ovs_v3_0_elections`, reloads page, verifies automatic self-healing recovery |
