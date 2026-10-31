# OVS Testing, Verification & Quality Assurance Guide

This document details the reproducible installation, ESLint static analysis, TypeScript typechecking, Node.js unit/service test suites, real Chromium browser End-to-End (E2E) Playwright test suites, production build validations, and troubleshooting steps for the Online Voting System (OVS) frontend prototype.

---

## 1. Canonical Verification Commands (`npm`)

`npm` is the sole canonical package manager for this repository (`packageManager: "npm@10.9.9"`, locked via `package-lock.json`).

| Check | Command | Operation Performed |
| :--- | :--- | :--- |
| **Reproducible Install** | `npm ci` | Cleanly installs exact dependency tree from `package-lock.json` |
| **ESLint Validation** | `npm run lint` | Runs `eslint .` via `eslint.config.js` across `src/**/*.{js,jsx}`, `tests/**/*.{js,mjs}`, and config files |
| **TypeScript Validation** | `npm run typecheck` | Runs `tsc --noEmit` via `tsconfig.json` across `src/` and `vite.config.ts` |
| **Unit & Service Tests** | `npm test` (or `npm run test:unit`) | Runs `node --import ./tests/loader.mjs --test tests/electionArchitecture.test.mjs` (**37 test suites**) |
| **Production Build** | `npm run build` | Runs `vite build` (`vite v8.3.5`) to produce the production bundle in `dist/` |
| **Production Preview** | `npm run preview` | Serves the compiled production build on `http://localhost:3000` |
| **Playwright Browser Setup** | `npx playwright install chromium` | Installs Playwright-managed Chromium binary (if not already pre-installed) |
| **Browser E2E Tests** | `npm run test:e2e` (or `npx playwright test`) | Runs **12 real Chromium browser E2E test suites** in `tests/e2e/*.spec.js` |

> **Distinct `lint` vs. `typecheck` Scripts**:
> - `npm run lint` executes **ESLint** (`eslint .`) using `eslint.config.js` to validate JavaScript/JSX syntax, React Hooks rules (`react-hooks/rules-of-hooks`), unused variables, and useless assignments.
> - `npm run typecheck` executes **TypeScript** (`tsc --noEmit`) using `tsconfig.json` (`allowJs: true`, `jsx: "react-jsx"`). Because the application source is predominantly JavaScript/JSX (`.js`/`.jsx`), `tsc --noEmit` validates module resolution, JSX compilation, and `vite.config.ts` types rather than full static TypeScript annotations across `.jsx` components.

---

## 2. Automated Node.js Test Suite Coverage (`tests/electionArchitecture.test.mjs`)

The automated Node.js test runner (`tests/electionArchitecture.test.mjs`) executes **37 test suites** covering Phases 1 through 7.7:

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

### Phase 7, 7.5, 7.6 & 7.7 — Data Integrity, Security, Demo Clock, E2E & Packaging Verification
23–29. **Phase 7 Audits**: 17-rule `auditElectionDataIntegrity` verification, provenance labeling (`VERIFIED_OFFICIAL` vs `DEMO_SAMPLE`), XSS/CSV/URL sanitization, accessibility semantics, and documentation presence.
30. **Phase 7.5.1 — Centralized Demo Clock & Election Timeline Validation**: Verifies `DEMO_CLOCK_CONFIG`, pre-polling guards, round-completion publication guards, and declaration guards.
31. **Phase 7.5.2 — Strict Ballot-to-Counting Separation & Zero Candidate-Choice Persistence**: Verifies `recordSimulatedParticipation` leaves `tallies` 100% unchanged and never stores candidate/party selections.
32. **Phase 7.5.3 — End-to-End User Journey Simulations & Documentation Path Verification**: Programmatically executes Scenarios A–G and verifies that every `src/...` path referenced in `README.md`, `ARCHITECTURE.md`, `TESTING.md`, `SECURITY-LIMITATIONS.md`, and `plan.md` exists on disk.
33–35. **Phase 7.6.1 – 7.6.3**: Participation timestamp consistency (`participatedAt` vs `recordedAt`), zero hardcoded fallback in `src/services/dataIntegrityService.js`, and Playwright E2E suite structure.
36. **Phase 7.7.1 — Election-Specific Simulation Timestamp Resolution & Zero Hardcoded Date Comparisons**:
    - Verifies `src/services/electionService.js` contains zero hardcoded `'2029-04-20'` comparisons.
    - Verifies default demo clock, valid election-specific `simulationTimestamp` and `simulationClockDate` (including `'2029-04-20'` when global clock is shifted, and different dates like `'2029-06-15T08:20:00.000Z'`), missing election-specific timestamp fallback, invalid election-specific timestamp fallback, and strict separation of `participatedAt` vs `recordedAt`.
37. **Phase 7.7.2 — Canonical npm Lockfile, ESLint Config, GitIgnore & GitHub Actions CI Readiness**:
    - Verifies `package-lock.json` exists, `bun.lock` is removed, `eslint.config.js` and `.github/workflows/ci.yml` exist, and `lint` (`eslint .`) is distinct from `typecheck` (`tsc --noEmit`).

---

## 3. Real Browser E2E Test Suite (`playwright.config.js` & `tests/e2e/`)

Playwright (`@playwright/test`) runs **12 real headless Chromium browser test suites** against `http://127.0.0.1:3000`:

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

---

## 4. Playwright Setup & Troubleshooting

1. **Installing Chromium on a Fresh Machine / CI**:
   ```bash
   npx playwright install chromium
   # On Linux CI runners that also need system shared libraries:
   npx playwright install --with-deps chromium
   ```
2. **Pre-Installed Container Headless Shell Support**:
   - `playwright.config.js` automatically checks if `/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell` exists in container environments where external binary downloads (`cdn.playwright.dev`) are restricted or where a newer Playwright version is installed alongside an existing system headless shell. When absent (e.g., on standard local machines or GitHub Actions runners after `npx playwright install chromium`), Playwright uses its standard downloaded Chromium binary automatically.
3. **Inspecting Failure Artifacts**:
   - On failure, screenshots are saved in `test-results/` and HTML reports are generated in `playwright-report/`. Run `npx playwright show-report` locally to inspect traces and screenshots.
