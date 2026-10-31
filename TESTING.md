# OVS Testing, Verification & Quality Assurance Guide

This document details the automated test suites, end-to-end user journey verifications, static analysis checks, and production build validations for the Online Voting System (OVS) frontend prototype.

---

## 1. Verification Commands

| Check | Command | Target / Scope |
| :--- | :--- | :--- |
| **Unit, Service & E2E Journey Tests** | `npm test` | Runs `node --test tests/electionArchitecture.test.mjs` (32 comprehensive test suites) |
| **ESLint Static Analysis** | `npm run lint` | Runs `eslint .` across all `.js` and `.jsx` files in `src/` |
| **Production Bundle Build** | `npm run build` | Runs `vite build` to verify zero unresolved imports or bundle errors |

---

## 2. Automated Test Suite Coverage (`tests/electionArchitecture.test.mjs`)

The automated test runner (`tests/electionArchitecture.test.mjs`) executes **32 test suites** covering Phases 1 through 7.5:

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

---

## 3. Browser E2E Verification Notes

- In environments where headless browser binaries (Chromium/Playwright) are installed, browser-level journeys can be run against `http://localhost:3000`.
- In container environments without system browser binaries, Scenarios A–G are verified deterministically via the Phase 7.5.3 integration journey suite in `tests/electionArchitecture.test.mjs` alongside `npm run build` and `npm run lint`.
