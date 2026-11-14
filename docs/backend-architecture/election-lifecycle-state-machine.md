# OVS Phase 8.5 — Election Lifecycle State Machine

Defined centrally in [`election.lifecycle.ts`](..\..\backend\src\modules\elections\election.lifecycle.ts) using existing `ElectionStatus` values.

## 1. Transition Matrix

| From State | Permitted Next State(s) | Endpoint / Permission | Notes |
|---|---|---|---|
| `DRAFT` | `UPCOMING` | `POST /transition` (`elections.manage_status`) | Publishes draft schedule |
| `DRAFT` | `CANCELLED` | `POST /cancel` (`elections.cancel`) | Requires reason |
| `UPCOMING` | `DRAFT`, `NOMINATION_OPEN` | `POST /transition` (`elections.manage_status`) | Return to draft or open nominations |
| `UPCOMING` | `CANCELLED` | `POST /cancel` (`elections.cancel`) | Requires reason |
| `NOMINATION_OPEN` | `NOMINATION_CLOSED` | `POST /transition` (`elections.manage_status`) | Close nominations |
| `NOMINATION_OPEN` | `CANCELLED` | `POST /cancel` (`elections.cancel`) | Requires reason |
| `NOMINATION_CLOSED` | `READY` | `POST /transition` (`elections.manage_status`) | Finalize pre-polling readiness |
| `NOMINATION_CLOSED` | `CANCELLED` | `POST /cancel` (`elections.cancel`) | Requires reason |
| `READY` | `POLLING_ACTIVE` | `POST /transition` (`elections.manage_status`) | Open simulated polling |
| `READY` | `CANCELLED` | `POST /cancel` (`elections.cancel`) | Requires reason |
| `POLLING_ACTIVE` | `POLLING_COMPLETED` | `POST /transition` (`elections.manage_status`) | Close polling |
| `POLLING_ACTIVE` | `CANCELLED` | `POST /cancel` (`elections.cancel`) | Emergency cancellation with reason |
| `POLLING_COMPLETED` | `COUNTING` | `POST /transition` (`elections.manage_status`) | Begin counting phase |
| `COUNTING` | `RESULTS_DECLARED` | `POST /transition` (`elections.manage_status`) | Mark counting finished |
| `RESULTS_DECLARED` | `ARCHIVED` | `POST /archive` (`elections.archive`) | Terminal historical archive |
| `CANCELLED` | `ARCHIVED` | `POST /archive` (`elections.archive`) | Terminal historical archive |
| `ARCHIVED` | *(None)* | — | Terminal immutable state |

## 2. Concurrency & Protections

- Generic `PATCH` requests reject `status` fields (`.strict()` Zod schema) and only allow metadata updates in `DRAFT` or `UPCOMING`.
- `updateMany` conditional checks (`where: { id, status, version }`) return `409 Conflict` on stale `expectedVersion` or concurrent status changes.
- Duplicate same-state transitions are rejected with `409 Conflict` without creating duplicate history rows.
