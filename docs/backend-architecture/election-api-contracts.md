# OVS Phase 8.5 — Election API Contracts

## 1. Administrative Election Endpoints (`/api/v1/admin/elections`)

All endpoints require an active `ADMIN` `ovs_session` cookie. State-changing methods (`POST`, `PATCH`) require `X-CSRF-Token`.

- `GET /api/v1/admin/elections/summary` (`elections.read`) — Returns jurisdiction-scoped dashboard totals (`total`, `lokSabha`, `stateAssembly`, `draft`, `active`, `completed`, `cancelled`, `archived`, `byStatus`).
- `GET /api/v1/admin/elections` (`elections.read`) — Query: `page`, `limit`, `search`, `type`, `stateId`, `status`, `sortBy`, `sortOrder`.
- `GET /api/v1/admin/elections/:electionId` (`elections.read` + Jurisdiction Check).
- `POST /api/v1/admin/elections` (`elections.create` + CSRF + Jurisdiction Check) -> `201 Created`.
- `PATCH /api/v1/admin/elections/:electionId` (`elections.update` + CSRF + Optimistic `expectedVersion`) -> `200 OK` / `409 Conflict`.
- `POST /api/v1/admin/elections/:electionId/transition` (`elections.manage_status` + CSRF + Transition Matrix) -> `200 OK` / `409 Conflict`.
- `POST /api/v1/admin/elections/:electionId/cancel` (`elections.cancel` + CSRF + `{ reason, expectedVersion? }`) -> `200 OK`.
- `POST /api/v1/admin/elections/:electionId/archive` (`elections.archive` + CSRF + `{ note?, expectedVersion? }`) -> `200 OK`.
- `GET /api/v1/admin/elections/:electionId/history` (`elections.history.read` + Jurisdiction Check).

## 2. Public Read-Only Election Endpoints (`/api/v1/elections`)

- `GET /api/v1/elections` & `GET /api/v1/elections/:electionId` exclude `DRAFT`, `CANCELLED`, and `ARCHIVED` elections and omit internal administrator IDs, cancellation reasons, archive notes, and concurrency `version` counters.
