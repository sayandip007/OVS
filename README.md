# Online Voting System (OVS) — India-Wide Election Management & Voting Portal

> **EDUCATIONAL FRONTEND PROTOTYPE DISCLAIMER**
> This application is a **frontend-only educational demonstration** of an India-wide Online Voting System (OVS) supporting **Lok Sabha General Elections**, **State Legislative Assembly Elections**, and **Simultaneous Elections**. It is **not** an official platform of the Election Commission of India (ECI), does not connect to any government electoral database, does not transmit real votes, and operates entirely in the browser using local React state and `localStorage` (`ovs_v3_0_*`).

---

## 1. Project Overview & Key Capabilities (Phases 1–7.7)

1. **Pan-India Electoral Geography (36 Jurisdictions)**
   - **28 Indian States** and **8 Union Territories** with official seat counts (**543 Lok Sabha seats**, **4,123 State Assembly seats**).
   - **72 Representative Districts**, **72 Parliamentary Constituencies (PCs)**, and **144 Assembly Constituencies (ACs)** with parent-PC linkage.
2. **Dual-Constituency & Simultaneous Election Architecture**
   - Every registered demo voter is mapped independently to:
     - One **Parliamentary Constituency (`PARLIAMENTARY`)** for Lok Sabha General Elections (`LOK_SABHA`).
     - One **Assembly Constituency (`ASSEMBLY`)** for State Legislative Assembly Elections (`STATE_ASSEMBLY`).
   - Completing participation in a Lok Sabha election (`LS-2029`) never alters the voter's status in a simultaneous State Assembly election (`WB-ASSEMBLY-2029` or `DL-ASSEMBLY-2029`), and vice versa.
3. **Centralized Demo Clock & Logical Election Timeline (`DEMO_CLOCK_CONFIG`)**
   - Centralized demonstration reference clock (`referenceDate: '2029-04-20'`, `referenceTimestamp: '2029-04-20T10:30:00.000Z'` in `src/utils/constants.js`) governs timeline evaluation, participation timestamps (`participatedAt`), and integrity audits (`src/services/dataIntegrityService.js`) with zero hardcoded fallback comparisons across:
     - **Past Completed Election**: `LS-2024` (`RESULTS_DECLARED`)
     - **Active Simulated Simultaneous Elections**: `LS-2029`, `WB-ASSEMBLY-2029`, `DL-ASSEMBLY-2029` (`POLLING_ACTIVE`)
     - **Upcoming Scheduled Election**: `MH-ASSEMBLY-2029` (`UPCOMING`, polling starts `2029-09-10`)
     - **Unpublished / In-Progress Constituency Results**: `RESULT-LS-2029-TN-PC-1` (`RESULT_READY_FOR_REVIEW`), `RESULT-LS-2029-MH-MUMBAI-NORTH` (`COUNTING_IN_PROGRESS`), `RESULT-MH-ASSEMBLY-2029-BANDRA-WEST` (`DRAFT`)
4. **Strict Separation of Demo Ballot & Counting Engine**
   - Candidate or NOTA selection on `/voter/elections/:electionId/ballot` exists **only** in volatile React component memory (`useState`) during ballot review.
   - Confirming participation calls `recordSimulatedParticipation` (`src/services/electionService.js`), which updates **only** `voter.elections[electionId]` (`status: 'VOTED'`, `participated: true`, `participatedAt` from centralized `getDemoReferenceIso`, `demoReference`, `referenceId`).
   - Individual voter ballot confirmations **never** store candidate choices and **never** increment candidate vote tallies.
   - Constituency counting sessions (`src/services/countingService.js`) run independently on deterministic FNV-1a seeded demonstration datasets.
5. **Complete Voter Portal (`/voter/*`)**
   - Simulated OTP login (`123456`, resend `654321`, 3 max attempts, 120s expiry) and 4-step cascading registration.
   - Voter Dashboard, Profile Management, Dual-Constituency Explorer, My Elections, Election Info, Candidate Directory, 4-Step Ballot & Non-Sensitive Receipt, Notifications, Participation History, and Settings.
6. **Complete ECI Administration Portal (`/eci/*`)**
   - 5 Role-Based Access Control (RBAC) profiles (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`, `READ_ONLY_AUDITOR`).
   - 16 administrative modules covering Dashboard, Elections, Create/Detail Election, States/UTs, Districts, Constituencies, Political Parties, Candidate Scrutiny, Voter Registry, Schedules, Turnout Monitoring, Announcements, Counting & Results Management, Append-Only Audit Logs, and System Settings (17-rule Data Integrity Audit, JSON Export/Import, Demo Reset).

---

## 2. Technology Stack & Supported Runtime Versions

- **Frontend Framework**: React `^19.0.1` (`react@19.3.1`, `react-dom@19.3.1`), React Router `^7.18.5`
- **Build Tool**: Vite `^8.3.0` (`vite@8.3.5`) with `@vitejs/plugin-react`
- **Styling**: Tailwind CSS `^4.3.3` (`@tailwindcss/vite`)
- **Icons & Motion**: `lucide-react` `^0.546.0`, `motion` `^12.23.24`
- **Linting & Typechecking**: ESLint `^10.14.0` (`eslint.config.js`), TypeScript `^7.0.2` (`tsconfig.json`)
- **Testing**: Node.js built-in test runner (`node:test`) + Playwright `^1.64.1` (`@playwright/test`)
- **Canonical Package Manager**: `npm` (`packageManager: "npm@10.9.9"`, canonical lockfile: `package-lock.json`)
- **Supported Runtime Versions**:
  - **Node.js**: `>=22.0.0` (verified on `v22.23.4`)
  - **npm**: `>=10.0.0` (verified on `10.9.9`)

---

## 3. Actual Project File Structure

```text
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── playwright.config.js
├── README.md
├── ARCHITECTURE.md
├── TESTING.md
├── SECURITY-LIMITATIONS.md
├── plan.md
├── PHASE_7_5_AUDIT.md
├── PHASE_7_5_FINAL_REPORT.md
├── PHASE_7_6_AUDIT.md
├── PHASE_7_6_FINAL_REPORT.md
├── PHASE_7_7_AUDIT.md
├── PHASE_7_7_FINAL_REPORT.md
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── assets/
│   │   └── index.js
│   ├── routes/
│   │   └── AppRoutes.jsx
│   ├── layouts/
│   │   ├── PublicLayout.jsx
│   │   ├── VoterLayout.jsx
│   │   └── AdminLayout.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   ├── ElectionContext.jsx
│   │   ├── VoterContext.jsx
│   │   └── NotificationContext.jsx
│   ├── data/
│   │   ├── states.js
│   │   ├── districts.js
│   │   ├── constituencies.js
│   │   ├── parties.js
│   │   ├── elections.js
│   │   ├── candidates.js
│   │   ├── voters.js
│   │   └── results.js
│   ├── services/
│   │   ├── adminPermissionService.js
│   │   ├── ballotValidationService.js
│   │   ├── candidateService.js
│   │   ├── constituencyService.js
│   │   ├── countingService.js
│   │   ├── dataIntegrityService.js
│   │   ├── electionService.js
│   │   └── storageService.js
│   ├── utils/
│   │   ├── constants.js
│   │   ├── electionHelpers.js
│   │   └── validation.js
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminSidebar.jsx
│   │   │   ├── DataTable.jsx
│   │   │   └── StatsCard.jsx
│   │   ├── ballot/
│   │   │   ├── BallotCandidateCard.jsx
│   │   │   ├── BallotHeader.jsx
│   │   │   ├── BallotReview.jsx
│   │   │   ├── CandidateProfileModal.jsx
│   │   │   ├── DemoConfirmationModal.jsx
│   │   │   ├── DemoReceipt.jsx
│   │   │   └── NOTACard.jsx
│   │   ├── common/
│   │   │   ├── EmptyState.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Loading.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Notification.jsx
│   │   │   ├── PageHeader.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── results/
│   │   │   └── ResultCharts.jsx
│   │   └── voter/
│   │       ├── CandidateCard.jsx
│   │       ├── ConstituencyCard.jsx
│   │       ├── ElectionCard.jsx
│   │       └── VotingStatus.jsx
│   └── pages/
│       ├── public/
│       │   ├── Home.jsx
│       │   ├── About.jsx
│       │   ├── ElectionInformation.jsx
│       │   ├── CandidateDirectory.jsx
│       │   ├── Results.jsx
│       │   ├── LokSabhaResults.jsx
│       │   ├── AssemblyResults.jsx
│       │   ├── ConstituencyResultDetail.jsx
│       │   ├── Feedback.jsx
│       │   └── NotFound.jsx
│       ├── voter/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Profile.jsx
│       │   ├── ConstituencyDetails.jsx
│       │   ├── ElectionHub.jsx
│       │   ├── ElectionDetailsPage.jsx
│       │   ├── BallotPage.jsx
│       │   ├── BallotReceiptPage.jsx
│       │   ├── Notifications.jsx
│       │   ├── VotingHistory.jsx
│       │   └── Settings.jsx
│       └── admin/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── ElectionManagement.jsx
│           ├── StateManagement.jsx
│           ├── DistrictManagement.jsx
│           ├── ConstituencyManagement.jsx
│           ├── PartyManagement.jsx
│           ├── CandidateManagement.jsx
│           ├── VoterManagement.jsx
│           ├── ScheduleManagement.jsx
│           ├── ElectionMonitoring.jsx
│           ├── AnnouncementManagement.jsx
│           ├── ResultsManagement.jsx
│           ├── AuditLogs.jsx
│           └── AdminSettings.jsx
└── tests/
    ├── loader.mjs
    ├── electionArchitecture.test.mjs
    └── e2e/
        ├── public-portal.spec.js
        ├── voter-registration.spec.js
        ├── voter-authentication.spec.js
        ├── lok-sabha-ballot.spec.js
        ├── assembly-ballot.spec.js
        ├── simultaneous-elections.spec.js
        ├── candidate-choice-privacy.spec.js
        ├── admin-election-management.spec.js
        ├── candidate-management.spec.js
        ├── counting-results.spec.js
        ├── data-integrity.spec.js
        └── recovery-reset.spec.js
```

---

## 4. Installation, Development, Build & Verification Commands

### Reproducible Installation
```bash
# Install exact locked dependencies from package-lock.json
npm ci
```

### Development & Production Preview
```bash
# Start development server on http://localhost:3000
npm run dev

# Build production bundle into dist/
npm run build

# Preview production bundle on http://localhost:3000
npm run preview
```

### Lint, Typecheck & Automated Tests
```bash
# Run ESLint across src/, tests/, and config files
npm run lint

# Run TypeScript compiler validation (tsc --noEmit)
npm run typecheck

# Run Node.js unit and service test suite (37 suites covering Phases 1–7.7)
npm test

# Install Playwright Chromium browser (if not already present)
npx playwright install chromium

# Run Playwright End-to-End (E2E) browser test suite (12 spec files)
npm run test:e2e
```

---

## 5. Demo Credentials

### Voter Portal (`/voter/login`)
- **Sample Voters**:
  - **West Bengal (Simultaneous LS + WB Assembly)**: `WBX1234567` / `9830011223` (Arindam Sen)
  - **Maharashtra (Active LS + Upcoming MH Assembly)**: `MHX2345678` / `9820112233` (Priya Deshmukh)
  - **Uttar Pradesh (Active LS)**: `UPX3456789` / `9415223344` (Rajeshwar Tiwari)
  - **Tamil Nadu (Active LS)**: `TNX4567890` / `9840334455` (Kavitha Subramanian)
  - **NCT of Delhi (Simultaneous LS + DL Assembly)**: `DLX5678901` / `9811445566` (Vikramaditya Mehra)
- **Simulated OTP**: `123456` (Resend OTP: `654321`)

### ECI Admin Portal (`/eci/login`)
- **Officers**:
  - `SUPER_ADMIN`: `ECI-SUPER-001` (Rajiv Kumar — Chief Election Commissioner Demo)
  - `NATIONAL_ADMIN`: `ECI-NAT-002` (Anup Chandra Pandey — National Election Administrator)
  - `STATE_ADMIN`: `ECI-WB-003` (Ariz Aftab — CEO West Bengal, scoped to `WB`)
  - `ELECTION_OFFICER`: `ECI-RO-004` (Smita Sharma — Returning Officer, scoped to `LS-2029` & `WB-ASSEMBLY-2029`)
  - `READ_ONLY_AUDITOR`: `ECI-AUD-005` (Meenakshi Sundaram — Read-Only Observer)
- **Passcode**: `admin123` (or `eci2029`)
- **Simulated 2FA OTP**: `123456`

---

## 6. Frontend Prototype Limitations

1. **Client-Side Persistence (`localStorage`)**: All data (`ovs_v3_0_*`) is stored locally in the user's browser and is not shared across devices or backed by a server database.
2. **Simulated Authentication & OTP**: Voter and ECI Admin logins use deterministic demo OTP codes (`123456` / `654321`). No SMS/email gateway or cryptographic token verification is performed.
3. **Frontend-Only RBAC**: Role checks and route guards operate in the React client for UI demonstration and cannot replace backend authorization in a real system.
4. **Educational Scope**: This prototype is not a legally valid or cryptographically verifiable online voting system and must never be used to conduct actual elections.
