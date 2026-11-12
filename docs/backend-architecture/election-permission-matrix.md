# OVS Phase 8.5 — Election Permission & Jurisdiction Matrix

## 1. Role-Permission Matrix

Defined in [`admin.permissions.ts`](file:///backend/src/modules/admin/admin.permissions.ts):

| Permission | `SUPER_ADMIN` | `NATIONAL_ADMIN` | `STATE_ADMIN` | `ELECTION_OFFICER` | `READ_ONLY_AUDITOR` |
|---|---|---|---|---|---|
| `elections.read` | Yes | Yes | Scoped (State Assembly) | Scoped (Assigned Elections) | Scoped Read-Only |
| `elections.create` | Yes | Yes | Scoped (State Assembly only) | No | No |
| `elections.update` | Yes | Yes | Scoped (State Assembly) | No | No |
| `elections.manage_status` | Yes | Yes | Scoped (State Assembly) | No | No |
| `elections.cancel` | Yes | Yes | Scoped (State Assembly) | No | No |
| `elections.archive` | Yes | Yes | Scoped (State Assembly) | No | No |
| `elections.history.read` | Yes | Yes | Scoped (State Assembly) | Scoped (Assigned Elections) | Scoped Read-Only |

## 2. Jurisdiction Scope Enforcement

- **WB `STATE_ADMIN`**: Can list, create, update, transition, cancel, and archive `STATE_ASSEMBLY` elections where `stateId = 'WB'`. Denied (`403`) for `LOK_SABHA` or `MH` elections.
- **`ELECTION_OFFICER`**: Can inspect elections and lifecycle history only for assigned `electionIds`. Denied (`403`) on create/update/cancel/archive and unassigned elections.
- **`READ_ONLY_AUDITOR`**: Can inspect authorized elections and history; all mutating endpoints return `403`.
