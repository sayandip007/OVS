# OVS Database Architecture, Migrations & Seeds Guide

**Database Engine:** PostgreSQL 16+  
**ORM:** Prisma ORM 6.4.1  
**Authoritative Schema:** `backend/prisma/schema.prisma`  
**Migration History:** `backend/prisma/migrations/`  
**Architecture Reference SQL:** `docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql` (disposable reference for architecture validation tests)  

---

## 1. Relational Model Inventory (28 Models)

1. `User` — Base user credentials and polymorphic association (`ADMIN` vs `VOTER`).
2. `AdminUser` — Detailed administrative officer profile and assigned state.
3. `AdminStateScope` — Multi-state delegation scopes for state admins.
4. `AdminElectionScope` — Election and constituency assignments for Returning Officers.
5. `AdminAuditLog` — Immutable security audit trail with redacted parameters.
6. `VoterProfile` — Demographic information, EPIC number, and PC/AC association.
7. `State` — 36 States and Union Territories with seat allocations.
8. `District` — Administrative districts within states.
9. `ParliamentaryConstituency` — Lok Sabha voting subdivisions.
10. `AssemblyConstituency` — State Legislative Assembly subdivisions.
11. `Election` — National and state elections.
12. `ElectionConstituency` — Mapping between elections and active constituencies.
13. `ElectionScheduleMilestone` — Chronological milestone checkpoints.
14. `PoliticalParty` — Registered national and state political parties.
15. `Candidate` — Candidates contesting elections.
16. `CandidateNomination` — Nomination applications, affidavits, and status.
17. `DemoParticipation` — Voter participation records (**strictly zero candidate fields**).
18. `CountingSession` — Constituency counting session lifecycle.
19. `CountingRound` — Cumulative round tallies and lead margin tracking.
20. `CandidateTally` — Synthetic votes allocated per candidate.
21. `TieResolution` — Immutable tie-break audit evidence and statutory method.
22. `Announcement` — Public and state-targeted administrative gazettes.
23. `VoterNotification` — In-app alerts and polling schedule reminders.
24: `NotificationPreference` — Voter opt-in and category notification settings.
25. `NotificationDelivery` — Idempotent notification outbox delivery tracking.
26. `SystemSetting` — Configurable operational parameters.
27. `SystemSettingHistory` — Versioned change log for system settings.
28. `FeatureFlag` — Canary toggles with rollout percentages and role targeting.

---

## 2. Database Integrity Constraints & Triggers

All custom constraints, partial indexes, and PL/pgSQL database triggers are committed as standard, version-controlled Prisma migrations in `backend/prisma/migrations/20261101000100_custom_database_integrity/migration.sql`. They execute automatically during standard schema deployment (`npm run prisma:migrate:deploy`).

**Key Integrity Protections:**
- **Constituency Polymorphism:** Exclusivity CHECK constraints ensure Lok Sabha records bind strictly to `parliamentary_constituency_id` and State Assembly records bind strictly to `assembly_constituency_id`.
- **Nomination Status Progression:** Enforces valid lifecycle state machine transitions (`DRAFT` &rarr; `SUBMITTED` &rarr; `VALIDATED` &rarr; `SCRUTINY_PASSED` &rarr; `APPROVED` or `REJECTED`).
- **Vote Tally Reconciliation:** Bi-directional trigger reconciliation ensures the sum of candidate tallies, NOTA, and rejected votes strictly equals total counted votes.
- **Tie Resolution Gating:** Dedicated INSERT trigger ensures tie resolutions only occur when session status is `TIED`, top candidates have equal non-zero votes, and resolution method is approved by an active, scoped administrator.
- **Round Immutability:** Protects completed counting rounds from tampering or deletion once subsequent rounds commence.

---

## 3. Migration & Seeding Runbook

### Deploy Migrations to PostgreSQL (Authoritative Deployment Path)
```bash
# Validate Prisma schema
npm run prisma:validate

# Generate Prisma Client
npm run prisma:generate

# Deploy all committed migrations (DDL + PL/pgSQL custom integrity triggers)
npm run prisma:migrate:deploy
```

> [!NOTE]
> `npm run prisma:migrate:deploy` deploys all DDL tables and custom PL/pgSQL triggers in a single atomic pipeline. Never manually apply architecture reference SQL (`docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql`) to a migrated database; triggers are already included in migration `20261101000100_custom_database_integrity`.

### Seed Synthetic Demo Dataset
```bash
# Seeding requires explicit opt-in and a development/demo database target
OVS_ALLOW_DEMO_SEED=true npx tsx backend/prisma/seed-demo.ts
```

---

## 4. Rollback & Disaster Recovery Protocol

Prisma does not generate down-migrations. If a migration failure or schema regression occurs in a live environment:

1. **Forward-Fix Migration (Standard):** Create a new forward-fix migration using `npx prisma migrate dev --name fix_regression` and deploy via `npm run prisma:migrate:deploy`.
2. **Point-In-Time Backup Restoration (Catastrophic):** If an unrecoverable data corruption occurs, restore the PostgreSQL database from the latest verified WAL / pg_dump snapshot using the Disaster Recovery Runbook (`docs/deployment/DISASTER_RECOVERY_RUNBOOK.md`).
