# OVS Database Architecture, Migrations & Seeds Guide

**Database Engine:** PostgreSQL 16  
**ORM:** Prisma ORM 5.22  
**Schema Path:** `backend/prisma/schema.prisma`  
**Native Integrity SQL:** `backend/prisma/CUSTOM_DATABASE_INTEGRITY.sql`  

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
15. `Candidate` — Synthetic candidates contesting elections.
16. `CandidateNomination` — Nomination applications, affidavits, and status.
17. `DemoParticipation` — Voter participation records (**strictly zero candidate fields**).
18. `CountingSession` — Constituency counting session lifecycle.
19. `CountingRound` — Cumulative round tallies and lead margin tracking.
20. `CandidateTally` — Synthetic votes allocated per candidate.
21. `TieResolution` — Immutable tie-break audit evidence and statutory method.
22. `Announcement` — Public and state-targeted administrative gazettes.
23. `VoterNotification` — In-app alerts and polling schedule reminders.
24. `NotificationPreference` — Voter opt-in and category notification settings.
25. `NotificationDelivery` — Idempotent notification outbox delivery tracking.
26. `SystemSetting` — Configurable operational parameters.
27. `SystemSettingHistory` — Versioned change log for system settings.
28. `FeatureFlag` — Canary toggles with rollout percentages and role targeting.

---

## 2. Native PostgreSQL Database Triggers (`CUSTOM_DATABASE_INTEGRITY.sql`)

PostgreSQL triggers enforce business rules that must not be bypassed by application bugs:

- `verify_election_constituency_type_fn()`: Validates that Lok Sabha elections only link to PCs and Assembly elections only link to ACs.
- `verify_candidate_nomination_status_fn()`: Prevents invalid lifecycle jumps in nomination review.
- `verify_candidate_tally_reconciliation_fn()`: Enforces that sum of candidate tallies, NOTA, and rejected votes matches round totals.
- `verify_tie_resolution_insert()`: Ensures tie resolution can only be created when session status is `TIED`, top candidates have equal non-zero votes, and resolution method is approved.
- `verify_counting_round_immutability()`: Freezes earlier counting rounds once subsequent rounds commence.

---

## 3. Migration & Seeding Runbook

```bash
# 1. Reset database and run all migrations from scratch
npx prisma migrate reset --force --schema=backend/prisma/schema.prisma

# 2. Apply custom PostgreSQL triggers
psql -U postgres -d ovs_development -f backend/prisma/CUSTOM_DATABASE_INTEGRITY.sql

# 3. Seed comprehensive synthetic demo fixtures
npx tsx backend/prisma/seed-demo.ts

# 4. Verify test database protection
# The application includes assertSafeTestDatabase() which blocks destructive test scripts
# from executing against production or remote databases.
```
