# OVS Phase 8.5 — Election Management Architecture

## 1. Educational & Demo-Only Scope

OVS preserves strict separation between **Lok Sabha (Parliamentary)** and **State Legislative Assembly** elections using synthetic `DEMO_SAMPLE` records. All administrative election actions are governed by server-side RBAC, jurisdiction-scope enforcement, and optimistic concurrency.

## 2. Data Model (`Election` & `ElectionLifecycleHistory`)

Extended via [`backend/prisma/schema.prisma`](file:///backend/prisma/schema.prisma) and forward migration [`20261112000300_phase_8_5_election_management_lifecycle/migration.sql`](file:///backend/prisma/migrations/20261112000300_phase_8_5_election_management_lifecycle/migration.sql):

- **Core Fields**: `id`, `name`, `type` (`LOK_SABHA` | `STATE_ASSEMBLY`), `year`, `stateId`, `status` (`ElectionStatus`), `country`, `targetJurisdiction`, `description`, `version` (optimistic concurrency), `metadataSource`.
- **Attribution**: `createdByAdminId`, `updatedByAdminId`, `cancelledAt`, `cancelledByAdminId`, `cancellationReason`, `archivedAt`, `archivedByAdminId`, `archiveNote`.
- **Database Constraints**:
  - `chk_election_type_state_consistency`: enforces `LOK_SABHA` => `state_id IS NULL` and `STATE_ASSEMBLY` => `state_id IS NOT NULL`.
  - `chk_election_version_positive`: enforces `version >= 1`.
  - `chk_election_cancelled_reason`: enforces cancellation timestamp and non-empty reason (>= 5 chars) when `status = 'CANCELLED'`.
  - `chk_election_archived_metadata`: enforces `archived_at IS NOT NULL` when `status = 'ARCHIVED'`.

## 3. Migration & Seed Commands

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```
