# OVS Phase 8.15.1 — Preflight Audit & Defect Reproduction Report

**Audit Timestamp**: 2026-11-14T19:20:00+05:30  
**Phase**: 8.15.1 (Release Blocker Remediation, Runtime Verification & UAT Correction)  
**Status**: PREFLIGHT COMPLETE — ALL FINDINGS REPRODUCED & ISOLATED  
**Audit Scope**: Full repository inspection covering backend runtime, Prisma seed scripts, authentication and OTP pipelines, Docker images and compose manifests, database migration references, UAT suites, and project handover documentation.

---

## 1. Executive Summary & Purpose

Following an independent source-code and runtime verification review of the Phase 8.15 release bundle, multiple critical release blockers, architectural discrepancies, and documentation inconsistencies were identified. In strict accordance with the Phase 8.15.1 governance directive:
- **No major new features** will be introduced.
- **Phase 8.16 will not be started**.
- Every single finding identified in the review has been reproduced and documented in this preflight report with exact root causes, reproduction evidence, required code modifications, and dedicated regression test specifications.
- No finding will be marked resolved without both code implementation and verified regression test execution.

---

## 2. Comprehensive Defect Reproduction Matrix

| ID | Finding / Area | Reproduction Evidence | Root Cause | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-8.15.1-01** | **Insecure Demo Seed System** (`backend/prisma/seed-demo.ts`) | Script unconditionally provisions administrators with hardcoded password `DemoAdmin@2029!`, uses `@eci.gov.in` email addresses, and overwrites existing administrator passwords on update. Zero checks for `NODE_ENV=production` or `NODE_ENV=staging`, no `OVS_ALLOW_DEMO_SEED=true` gate, and no target database verification. | Lack of environment guards, database assertion, and defensive upsert policies in `seedDemoDataset()`. | **CRITICAL** |
| **DEF-8.15.1-02** | **Insecure OTP Provider Environment Handling** (`backend/src/modules/auth/`) | `DevelopmentOtpProvider` is instantiated by default in `createAuthRouter()` regardless of environment. Route `/dev/latest-otp` is exposed whenever `NODE_ENV !== 'production'` (thus exposed in `staging`). No `ALLOW_OTP_INSPECTION` configuration flag exists. `server.ts` does not pass a production provider. | Default fallback to development provider, absence of explicit opt-in inspection flag, and missing production provider validation. | **HIGH** |
| **DEF-8.15.1-03** | **Inconsistent Voter Verification Semantics** (`VoterProfile` / `auth.repository.ts`) | Voter registration automatically sets `isVerified: true` in `backend/src/modules/auth/auth.repository.ts` while `auth.controller.ts` returns `accountStatus: 'UNVERIFIED'`. Notification service sends emails to unverified voters. | Conflation of demo voter registration with actual identity/email verification; hardcoded `isVerified: true` in repository and Prisma schema. | **HIGH** |
| **DEF-8.15.1-04** | **Broken Backend Docker Build Context** (`backend/Dockerfile`) | `backend/Dockerfile` executes `COPY package.json package-lock.json* ./` and `npm ci`, but no `backend/package-lock.json` exists in the repository. Later, line 35 runs `npx prisma generate` after `npm prune --omit=dev`, which fails when Prisma CLI is pruned. | Missing package-lock.json in `./backend` and invoking pruned devDependency CLI in production runner stage. | **HIGH** |
| **DEF-8.15.1-05** | **Flawed Development Docker Compose Workflow** (`docker-compose.yml`) | `backend-api` runs `npm run dev` (`tsx watch`) inside a container built from a production-pruned image. `frontend-dev` mounts an empty anonymous volume for `/app/node_modules` without running `npm install`, causing Vite startup to fail. | Incompatible multi-stage image targeting in development compose and uninitialized node_modules volume. | **HIGH** |
| **DEF-8.15.1-06** | **Production Frontend Misconfiguration** (`docker-compose.production.yml`) | `frontend-proxy` build args specify `VITE_DATA_SOURCE_MODE: LOCAL_DEMO` instead of `BACKEND_API`. Production stack fails to communicate with the backend API. | Build arg defaulted to standalone demo mode in production compose file. | **MEDIUM** |
| **DEF-8.15.1-07** | **Phantom Database Integrity SQL Reference** (Handover Documentation) | Handover documents (`LOCAL_SETUP_GUIDE.md`, `DATABASE_AND_MIGRATIONS.md`, etc.) instruct users to apply `backend/prisma/CUSTOM_DATABASE_INTEGRITY.sql` (file does not exist). Integrity SQL is already encapsulated in committed Prisma migrations (`20261101000100_custom_database_integrity`). | Obsolete manual execution instructions referencing old draft paths rather than canonical `prisma migrate deploy`. | **MEDIUM** |
| **DEF-8.15.1-08** | **Simulated UAT Misclassified as Genuine UAT** (`uatLifecycle.unit.test.ts`) | `uatLifecycle.unit.test.ts` was titled and documented as comprehensive UAT, but executes pure in-memory unit tests with in-memory Sets and mock functions. Browser Playwright tests only execute against `LOCAL_DEMO`. | Unit test simulations labeled as end-to-end UAT; missing dual-mode Playwright configuration for `BACKEND_API`. | **HIGH** |
| **DEF-8.15.1-09** | **Real Person Identities & Government Domains in Synthetic Data** | Real political leaders used in `src/data/candidates.js` (lines 194, 208, 321-391); real ECI officials in `README.md`; `@eci.gov.in` domain used in demo seeds and docs; absolute `file:///C:/Users/...` links in handover docs. | Lack of strict synthetic entity sanitization and hardcoded local Windows file links in documentation. | **MEDIUM** |

---

## 3. Detailed Finding Inspection & Root Cause Analysis

### 3.1 Finding 1: Insecure Demo Seed System (`backend/prisma/seed-demo.ts`)
- **Inspection**:
  - `seed-demo.ts` line 56: `const demoAdminPassword = 'DemoAdmin@2029!';`
  - Lines 130-143: Updates existing user password hash to the demo password hash.
  - Lines 71-121: Creates accounts with emails like `superadmin.demo@eci.gov.in`.
  - Zero checks for `process.env.NODE_ENV === 'production'` or `'staging'`.
  - Zero checks for `process.env.OVS_ALLOW_DEMO_SEED === 'true'`.
  - Zero validation that target database is safe for demo seeding.
- **Required Remediation**:
  1. Add strict environment checks: refuse execution if `NODE_ENV === 'production'` or `NODE_ENV === 'staging'`.
  2. Require explicit `OVS_ALLOW_DEMO_SEED=true`.
  3. Validate database name using `assertSafeTestDatabase()` or equivalent regex (`*_dev`, `*_test`, `*_demo`).
  4. Query existing administrators before updating: never overwrite password or status of non-demo administrators.
  5. Replace `@eci.gov.in` with `.invalid` or `.local` domains (`superadmin.demo@ovs-demo.invalid`).
  6. Use clearly fictional names (e.g. "Dev Super Administrator (DEMO_SAMPLE)").
  7. Add automated tests proving refusal when conditions are violated.

### 3.2 Finding 2: Correct OTP Provider Environment Handling
- **Inspection**:
  - `backend/src/modules/auth/auth.routes.ts` lines 34-36: defaults to `new DevelopmentOtpProvider()` unconditionally.
  - Line 145: `if (process.env.NODE_ENV !== 'production')` enables `/dev/latest-otp` and `/dev/otp/:identifier`. In `staging`, this exposes plain-text OTPs!
  - `backend/src/config/env.ts`: No configuration option `ALLOW_OTP_INSPECTION`.
  - `backend/src/server.ts`: Does not configure OTP provider; silently runs `DevelopmentOtpProvider` in production, which returns `true` from `sendOtp` without delivering anything.
- **Required Remediation**:
  1. Add `ALLOW_OTP_INSPECTION: z.coerce.boolean().default(false)` in `backend/src/config/env.ts`.
  2. In `env.ts`, strictly reject `ALLOW_OTP_INSPECTION=true` when `NODE_ENV === 'production'` or `NODE_ENV === 'staging'`.
  3. In `auth.routes.ts`, mount `/dev/otp` inspection endpoints ONLY when `ALLOW_OTP_INSPECTION=true` AND `NODE_ENV === 'development' | 'test'`.
  4. Create `ProductionDisabledOtpProvider` or require explicit provider injection in production/staging; if unconfigured, fail closed on OTP request rather than faking successful delivery.
  5. Add unit tests verifying provider selection and inspection endpoint blocking across `development`, `test`, `staging`, and `production`.

### 3.3 Finding 3: Correct Voter Verification Semantics
- **Inspection**:
  - `backend/src/modules/auth/auth.repository.ts` line 205: hardcodes `isVerified: true` upon voter registration.
  - `backend/src/modules/auth/auth.controller.ts` line 36: returns `accountStatus: 'UNVERIFIED'`.
  - `backend/src/modules/notifications/notifications.service.ts` lines 714, 774: gates email notifications on `voter.isVerified`.
  - Simulated OTP challenge does not constitute real statutory identity verification or verified email confirmation.
- **Required Remediation**:
  1. Change default for new registrations in `auth.repository.ts` to `isVerified: false` (or explicitly reflect unverified status).
  2. For synthetic demo voters in `seed.ts` and `seed-demo.ts`, distinguish `isDemoEligible: true` / demo-permitted status from official statutory verification.
  3. Ensure notification email delivery explicitly checks verified email state or safe demo rule without assuming registration implies verification.
  4. Add regression tests validating registration response consistency, verification state transitions, and notification dispatch rules.

### 3.4 Finding 4: Repair Backend Docker Build
- **Inspection**:
  - Run `ls backend/package-lock.json`: File does not exist! Root has `package-lock.json`, but `backend/` was missing its independent lockfile.
  - `backend/Dockerfile` line 35: `RUN npm prune --omit=dev && npx prisma generate --schema=prisma/schema.prisma`. Pruning devDependencies removes `prisma` CLI!
- **Required Remediation**:
  1. Generate clean, reproducible `backend/package-lock.json` matching `backend/package.json`.
  2. Update `backend/Dockerfile` to generate Prisma Client in the build stage, copy the generated client into the runner stage, and eliminate `npx prisma generate` after pruning.
  3. Ensure `npm ci` is executed reliably in `base`/`deps` stages.
  4. Verify production image build with `docker build` and ensure non-root `node` user execution.

### 3.5 Finding 5: Repair Development Docker Compose
- **Inspection**:
  - `docker-compose.yml`:
    - `backend-api` mounts `./backend:/app` and runs `sh -c "npx prisma migrate deploy ... && npm run dev"`, but uses the production Dockerfile which pruned dependencies.
    - `frontend-dev` uses `image: node:22-alpine` with empty `/app/node_modules` volume and runs `npm run dev` without `npm install`.
- **Required Remediation**:
  1. Define a dedicated development Dockerfile (`backend/Dockerfile.dev` or multi-stage target `dev`) retaining dev dependencies (`tsx`, `typescript`, `@types/*`).
  2. Update `frontend-dev` command or image to ensure dependencies are installed (`sh -c "npm install && npm run dev"`).
  3. Ensure health checks and network dependencies wait for PostgreSQL readiness.

### 3.6 Finding 6: Repair Production Frontend API Configuration
- **Inspection**:
  - `docker-compose.production.yml` lines 76-78:
    ```yaml
    args:
      VITE_API_BASE_URL: /api/v1
      VITE_DATA_SOURCE_MODE: LOCAL_DEMO
    ```
- **Required Remediation**:
  1. Change `VITE_DATA_SOURCE_MODE` build arg in `docker-compose.production.yml` to `BACKEND_API`.
  2. Verify Nginx proxy configuration passes session cookies, CSRF tokens, and API requests to `backend-api:5000`.
  3. Add automated test checking production compose build configuration.

### 3.7 Finding 7: Correct Migrations & Database Setup Documentation
- **Inspection**:
  - Handover docs mention `psql -d ovs_development -f backend/prisma/CUSTOM_DATABASE_INTEGRITY.sql`.
  - The actual file is in `docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql` (an architecture reference), while the real migration is in `backend/prisma/migrations/20261101000100_custom_database_integrity/migration.sql`.
  - Running the file again on a migrated database duplicates triggers and throws errors.
- **Required Remediation**:
  1. Remove all instructions referring to `backend/prisma/CUSTOM_DATABASE_INTEGRITY.sql`.
  2. Document `npx prisma migrate deploy --schema=backend/prisma/schema.prisma` as the single authoritative database schema deployment command.
  3. Correct rollback and troubleshooting documentation: explain forward-fix migrations and backup restoration instead of nonexistent "down migrations".

### 3.8 Finding 8: Genuine UAT & Dual-Mode Playwright
- **Inspection**:
  - `backend/tests/unit/uatLifecycle.unit.test.ts` executes in-memory mocks and was incorrectly claimed as end-to-end UAT.
  - `playwright.config.js` only launches Vite dev server with default `LOCAL_DEMO`.
- **Required Remediation**:
  1. Retitle and clarify `uatLifecycle.unit.test.ts` as simulated lifecycle unit tests.
  2. Ensure real PostgreSQL integration tests in `api.integration.test.ts` cover all required UAT flows with genuine HTTP endpoints, cookies, CSRF, and database state.
  3. Configure Playwright to support both `LOCAL_DEMO` and `BACKEND_API` modes.

### 3.9 Finding 9: Documentation Sanitization & Fictional Identities
- **Inspection**:
  - `src/data/candidates.js` contains names of real living political figures.
  - `README.md` and handover files contain names of real Election Commission officers.
  - Multiple handover files contain local Windows `file:///C:/Users/...` hyperlinks.
  - Synthetic data uses `@eci.gov.in` emails.
- **Required Remediation**:
  1. Replace real political figures in `src/data/candidates.js` with clearly fictional names (e.g. "Vikramaditya Verma (Demo Candidate)").
  2. Replace real ECI officer names in `README.md` and docs with fictional personas (e.g. "Dev Super Administrator").
  3. Replace `@eci.gov.in` emails in seeds and docs with `.invalid` or `.local` domains.
  4. Replace all absolute `file:///C:/Users/...` URLs in documentation with relative repo links.

---

## 4. Remediation Plan & Execution Sequence

1. **Step 1 — Backend Lockfile & Docker Build Fixes**:
   - Generate `backend/package-lock.json`.
   - Update `backend/Dockerfile` and `Dockerfile.dev`.
   - Update `docker-compose.yml` and `docker-compose.production.yml`.
2. **Step 2 — Seed System Hardening (`backend/prisma/seed-demo.ts`)**:
   - Add environment check (`NODE_ENV !== 'production' && NODE_ENV !== 'staging'`).
   - Require `OVS_ALLOW_DEMO_SEED=true`.
   - Add database safety guard.
   - Sanitize administrator emails to `.invalid` and protect existing non-demo admins.
   - Write unit tests for seed safety.
3. **Step 3 — OTP Provider & Environment Security**:
   - Update `backend/src/config/env.ts` with `ALLOW_OTP_INSPECTION`.
   - Update `otp.service.ts` and `auth.routes.ts`.
   - Add tests verifying provider selection and inspection gating across environments.
4. **Step 4 — Voter Verification Semantics**:
   - Align `isVerified` on registration to `false`.
   - Update voter notification eligibility checks.
   - Add regression tests.
5. **Step 5 — Real Persona Sanitization**:
   - Update `src/data/candidates.js` to eliminate real political figure names.
   - Update `README.md` and handover files to eliminate real officer names and `@eci.gov.in` emails.
6. **Step 6 — Documentation Hyperlink & Migration Cleanup**:
   - Remove `CUSTOM_DATABASE_INTEGRITY.sql` manual execution references from handover docs.
   - Replace absolute `file:///C:/Users/...` links with relative links.
7. **Step 7 — Genuine UAT & Playwright Configuration**:
   - Update `playwright.config.js` with dual-mode support.
   - Verify `api.integration.test.ts` genuine PostgreSQL UAT coverage.
8. **Step 8 — Full Verification & Final Handover Report**:
   - Run full verification suite (tests, typechecks, linter, builds).
   - Author `docs/handover/PHASE_8_15_1_IMPLEMENTATION_REPORT.md`.
