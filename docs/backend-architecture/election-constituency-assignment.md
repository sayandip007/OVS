# Election Constituency Assignment Architecture (Phase 8.7)

> **Status**: Implemented (Phase 8.7)  
> **Scope**: Educational Indian Election Simulation (DEMO_SAMPLE) — Parliamentary (PC) and Assembly (AC) constituency assignment only.

## 1. Compatibility & Isolation Rules

- **Lok Sabha (`LOK_SABHA`)**: May only be assigned `PARLIAMENTARY` constituencies (`parliamentary_constituencies`). Any `ASSEMBLY` constituency is rejected (`INVALID_TYPE`).
- **State Legislative Assembly (`STATE_ASSEMBLY`)**: May only be assigned `ASSEMBLY` constituencies (`assembly_constituencies`) whose `stateId` matches `election.stateId`. Cross-state assignments are rejected (`CROSS_STATE_MISMATCH`), and `PARLIAMENTARY` constituencies are rejected (`INVALID_TYPE`).
- **Database Trigger Defense-in-Depth**: `verify_election_constituency_mapping` in `20261101000100_custom_database_integrity` enforces these invariants at the PostgreSQL row level alongside partial unique constraints on `(election_id, parliamentary_constituency_id)` and `(election_id, assembly_constituency_id)`.

## 2. Bulk Assignment & Preview

- **`POST /api/v1/admin/elections/:electionId/constituencies/preview`**: Non-mutating dry-run returning per-item status (`VALID`, `NOT_FOUND`, `INVALID_TYPE`, `CROSS_STATE_MISMATCH`, `OUT_OF_ADMIN_SCOPE`, `DUPLICATE_IN_BATCH`, `ALREADY_ASSIGNED`).
- **`POST /api/v1/admin/elections/:electionId/constituencies/bulk`**: All-or-nothing transactional assignment (up to 200 per batch). If any row fails validation, the entire transaction is rejected with `422 ValidationProblemError` and row-level details.

## 3. Removal Protection & History

- **Nomination Reference Guard**: `DELETE /api/v1/admin/elections/:electionId/constituencies/:constituencyId` rejects removal with `409 ConflictProblemError` if any `CandidateNomination` exists for that `(electionId, constituencyId)`.
- **Audit Trail**: Every assignment and removal writes an immutable `ElectionConstituencyHistory` row (`ASSIGNED`, `BULK_ASSIGNED`, `REMOVED`) and an `AdminActionLog` security event.
