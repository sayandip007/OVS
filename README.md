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

- **Frontend Framework**: React `^19.0.1` (`react@19.0.1`, `react-dom@19.0.1`), React Router `^7.5.0`
- **Build Tool**: Vite `^6.2.0` with `@vitejs/plugin-react`
- **Styling**: Tailwind CSS `^4.3.4` (`@tailwindcss/vite`)
- **Icons & UI**: `lucide-react` `^0.546.0`
- **Backend Foundation (Phase 8.2 Modular Monolith)**:
  - Node.js 22+ (ES Modules)
  - Express 5 (`5.1.0`)
  - TypeScript (`~5.8.2`, strict mode)
  - PostgreSQL 16+
  - Prisma ORM (`6.4.1`) with explicit snake_case physical mappings and custom PL/pgSQL database integrity triggers
  - Zod (`3.24.2`) for environment configuration and HTTP request validation
  - Pino (`9.6.0`) & `pino-http` (`10.5.0`) structured JSON logger
  - Helmet (`8.1.0`), CORS (`2.8.5`), and `express-rate-limit` (`7.5.0`)
  - RFC 9457 Problem Details error responses (`application/problem+json`)
- **Testing**:
  - Node.js built-in test runner (`node:test`)
  - Architecture & SQL Consistency Test Suite (55 automated tests)
  - Election Architecture & Lifecycle Suite (37 automated tests)
  - Backend Unit & Integration Tests (`node:test` + `supertest@7.0.0`)
  - Playwright `^1.51.1` (`@playwright/test`) End-to-End browser test suite
- **Canonical Package Manager**: `npm` (`packageManager: "npm@10.9.2"`, canonical lockfile: `package-lock.json`)
- **Supported Runtime Versions**:
  - **Node.js**: `>=22.0.0`
  - **npm**: `>=10.0.0`
  - **PostgreSQL**: `16+` (for backend development & database verification)

---

## 3. Actual Project File Structure

```text
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── .gitignore
├── docker-compose.yml
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
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   ├── common/
│   │   └── modules/
│   └── tests/
│       ├── unit/
│       └── integration/
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

## 4. Setup, Development, Build & Verification Guide

### 4.1 Prerequisites
- **Node.js**: `>=22.0.0` (Verify with `node -v`)
- **npm**: `>=10.0.0` (Verify with `npm -v`)
- **Docker & Docker Compose** *(Optional, for PostgreSQL 16 containerized backend)*: Verify with `docker compose version`

---

### 4.2 Environment Configuration
Copy the provided environment template to initialize local settings:
```bash
# Copy root environment configuration
cp .env.example .env

# (Optional) Copy backend environment configuration if running backend independently
cp backend/.env.example backend/.env
```

The application supports dual runtime data-source modes configured via `VITE_DATA_SOURCE_MODE` in `.env`:
- **`LOCAL_DEMO`** *(Default)*: Operates 100% in the browser using curated demonstration datasets and `localStorage`. Zero backend server or database setup required.
- **`BACKEND_API`**: Directs the frontend API client (`src/services/apiClient.js`) to communicate with the Express 5 + PostgreSQL 16 backend at `http://localhost:5000/api/v1`.

---

### 4.3 Mode A: Frontend Standalone Demo (Quick Start)
To run the educational voting prototype with zero backend dependencies:

```bash
# 1. Install dependencies from package-lock.json
npm ci

# 2. Start the Vite development server (Port 3000)
npm run dev

# 3. Open http://localhost:3000 in your browser
```

To create and preview the optimized production build:
```bash
# Build production bundle into dist/
npm run build

# Preview production bundle on http://localhost:3000
npm run preview
```

---

### 4.4 Mode B: Backend & PostgreSQL Local Setup
To run the Phase 8.2 modular monolith backend with a live PostgreSQL 16 database:

#### 1. Start PostgreSQL 16
You can launch a lightweight PostgreSQL 16 container via Docker:
```bash
docker run --name ovs-postgres -e POSTGRES_USER=ovs_admin -e POSTGRES_PASSWORD=ovs_secret_dev -e POSTGRES_DB=ovs_db -p 5432:5432 -d postgres:16-alpine
```
*(Or connect to an existing local PostgreSQL 16 instance and update `DATABASE_URL` in `.env`)*

#### 2. Bootstrap Database Schema & Seed Data
```bash
# Validate Prisma schema
npm run prisma:validate

# Generate Prisma Client
npm run prisma:generate

# Deploy migrations (DDL + PL/pgSQL custom integrity triggers)
npm run prisma:migrate:deploy

# Seed synthetic DEMO_SAMPLE dataset (idempotent)
npm run prisma:seed
```

#### 3. Start Backend API Server
```bash
# Start backend server in development mode with live watch (Port 5000)
npm run backend:dev

# Verify health probes
curl http://localhost:5000/api/v1/health/live
curl http://localhost:5000/api/v1/health/ready
```

---

### 4.5 Mode C: Full-Stack Docker Compose Setup
Run the entire platform (PostgreSQL 16, Backend API on port 5000, and Frontend on port 3000) with a single command:

```bash
# Build and start all services in the background
docker compose up -d --build

# View container logs
docker compose logs -f

# Tear down all services and networks
docker compose down
```

---

### 4.6 Verification, Linting, Typechecking & Test Suites

#### Full Test Suite Execution
```bash
# Run all 92 automated tests (37 Election Architecture tests + 55 Architecture & Database Consistency tests)
npm test

# Run individual test suites
npm run test:unit            # 37 Election architecture & lifecycle tests
npm run test:architecture    # 55 Database integrity, Prisma schema, & trigger consistency tests
```

#### Backend Unit & Integration Tests
```bash
# Run backend foundation unit tests (15 tests: Zod validation, Problem Details, error mapping)
npm run backend:test:unit

# Run backend API integration tests against live PostgreSQL 16 (requires running database)
npm run backend:test:integration

# Run all backend tests
npm run backend:test
```

#### Code Quality, Typechecking & Linting
```bash
# Frontend ESLint validation
npm run lint

# Frontend TypeScript compiler check (tsc --noEmit)
npm run typecheck

# Backend TypeScript compiler check
npm run backend:typecheck

# Backend TypeScript lint
npm run backend:lint

# Backend production build
npm run backend:build
```

#### Playwright Browser End-to-End (E2E) Testing
```bash
# Install Playwright Chromium browser binary (if not already installed)
npx playwright install chromium

# Run all 12 browser E2E test specs
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
