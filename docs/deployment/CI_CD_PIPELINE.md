# OVS Continuous Integration & Continuous Delivery (CI/CD) Pipeline

## 1. Overview

The OVS CI/CD automation is built using GitHub Actions to enforce comprehensive static analysis, security validation, architecture consistency, and database trigger verification on every commit and pull request.

- **Continuous Integration Workflow:** [.github/workflows/ci.yml](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/.github/workflows/ci.yml)
- **Release Automation Workflow:** [.github/workflows/release.yml](file:///c:/Users/Sayandip%20Saha/OneDrive/Desktop/OVS/.github/workflows/release.yml)

---

## 2. CI Verification Pipeline (The 16 Canonical Verification Steps)

The CI pipeline runs across two parallel jobs on Ubuntu Linux with Node.js 22 LTS and live PostgreSQL 16:

### Job 1: `frontend-and-architecture`
1. **Frontend Linting:** Executes `npm run lint` with ESLint 9.
2. **Frontend Typechecking:** Verifies TypeScript types with `npm run typecheck`.
3. **Frontend Unit & Service Suite:** Runs 37 unit tests across candidate, election, and voter services.
4. **Architecture & SQL Consistency Suite:** Executes 55 static architecture tests validating database schema alignment, state machines, and trigger parity.
5. **Frontend Production Build:** Compiles the Vite SPA bundle (`npm run build`).
6. **Playwright E2E Suite:** Runs Chromium browser tests verifying UI flows and navigation.

### Job 2: `backend-and-postgresql-verification`
7. **Prisma Schema Validation:** Validates `prisma/schema.prisma` syntax.
8. **Prisma Client Generation:** Generates type-safe database client.
9. **Backend Linting:** Runs TypeScript typechecks on backend source.
10. **Backend Build:** Compiles backend code using `tsconfig.build.json`.
11. **Backend Unit Test Suite:** Executes 137 unit tests covering RBAC, auth, counting, elections, voting, notifications, settings, and DevOps.
12. **Bootstrap Phase 8.1.6 Schema & Custom Triggers:** Pushes initial DDL and executes `CUSTOM_DATABASE_INTEGRITY.sql` on live PostgreSQL 16.
13. **31-Scenario PostgreSQL Suite:** Executes `tests/postgresql-validation.sql` validating all database triggers, advisory locks, tie resolution constraints, and immutability rules.
14. **Reset Schema & Apply Prisma Migrations:** Migrates live database with `prisma migrate deploy`.
15. **Idempotent Seed Verification:** Runs `prisma:seed` twice consecutively to guarantee seed idempotency.
16. **Live Backend Integration Tests & Bootstrap CLI:** Runs Supertest API integration tests and verifies idempotent `SUPER_ADMIN` CLI bootstrap.

### Job 3: `docker-and-deployment-verification`
17. **Docker Compose Validation:** Validates `docker-compose.yml` and `docker-compose.production.yml` syntax.
18. **Shell Script Syntax Check:** Executes `bash -n` on all backup and recovery scripts.

---

## 3. Release Pipeline (`release.yml`)

Triggered on version tags (e.g. `v1.0.0`) or manual workflow dispatch:
1. Runs full test and build suites.
2. Generates Software Bill of Materials (SBOM) in SPDX 2.3 JSON format (`build/sbom/ovs-sbom.spdx.json`).
3. Builds hardened production Docker images for `ovs-backend` and `ovs-frontend`.
4. Uploads versioned release artifacts and SBOM reports.
