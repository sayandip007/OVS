# OVS Release Packaging & Versioning Checklist

**Target Version:** `v1.0.0-rc.1` (Release Candidate 1)  
**Classification:** Pre-Release Candidate for Handover & Final Evaluation  

---

## 1. Release Verification Quality Checklist

- [x] **Git Cleanliness:** No temporary files, untracked credentials, or debug scripts committed.
- [x] **Secret Exposure Audit:** Zero hardcoded API keys, private keys, or real production secrets in tracked files.
- [x] **Dependencies Audit:** `package.json` and `package-lock.json` lockfiles synchronized; no deprecated high-severity vulnerabilities.
- [x] **TypeScript Validation:** `npm run typecheck` and `npm run backend:typecheck` pass with 0 errors.
- [x] **Automated Test Validation:**
  - 184 Unit & Integration Tests pass (`npm run backend:test:unit`).
  - 55 Architecture Invariant Tests pass (`npm test`).
  - 24 Dedicated UAT Scenario Tests pass (`backend/tests/unit/uatLifecycle.unit.test.ts`).
- [x] **Production Build Validation:** `npm run build` compiles clean Vite production bundle in $\sim 21$ seconds.
- [x] **Seed Script Idempotency:** `backend/prisma/seed-demo.ts` executes repeatedly without duplicating records or throwing constraint violations.
- [x] **Docker Image Compilation:** `Dockerfile.frontend` and `Dockerfile.backend` build multi-stage production images cleanly.
- [x] **Privacy Certification:** Verified zero candidate choice persistence or transmission.

---

## 2. Upgrade & Rollback Procedures

### Upgrade Instructions
1. Pull new release tag or artifact archive.
2. Run database migration: `npm run prisma:migrate:deploy` (applies all DDL and PL/pgSQL database integrity triggers).
3. Install production dependencies: `npm install --omit=dev`.
4. Restart application services via container or process manager (`docker compose up -d` or `pm2 restart ovs-backend`).

### Rollback Instructions
1. Revert container image to previous tag: `docker compose pull backend-api:<PREVIOUS_TAG> && docker compose up -d`.
2. If database schema was altered, deploy a forward-fixing migration via `npm run prisma:migrate:deploy` or restore database from the verified point-in-time PostgreSQL backup snapshot per `docs/deployment/DISASTER_RECOVERY_RUNBOOK.md`.
3. Verify service health via `curl http://localhost:5000/api/v1/health`.
