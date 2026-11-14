# OVS Phase 8.4 — Centralized RBAC Permission Matrix

## 1. Role Hierarchy

Defined centrally in [`admin.permissions.ts`](..\..\backend\src\modules\admin\admin.permissions.ts):

| Rank | Role (`AdminRole`) | Intended Jurisdiction Scope | Provisioning Authority |
| :---: | :--- | :--- | :--- |
| **5** | `SUPER_ADMIN` | Global / entire platform | Bootstrapped securely; may manage any role |
| **4** | `NATIONAL_ADMIN` | Nationwide operational level | May provision/manage `STATE_ADMIN`, `ELECTION_OFFICER`, `READ_ONLY_AUDITOR` |
| **3** | `STATE_ADMIN` | Assigned State(s) via `admin_state_scopes` | May provision/manage `ELECTION_OFFICER` within own state(s) |
| **2** | `ELECTION_OFFICER` | Assigned Elections & Constituencies | None (`admin.users.*` denied) |
| **1** | `READ_ONLY_AUDITOR` | Read-only (global or assigned state/election) | None (all mutating operations strictly denied) |

---

## 2. Permission Matrix

Permissions are evaluated independently of jurisdiction scopes: holding a permission grants capability **only** within authorized jurisdiction bounds.

| Permission Key | `SUPER_ADMIN` | `NATIONAL_ADMIN` | `STATE_ADMIN` | `ELECTION_OFFICER` | `READ_ONLY_AUDITOR` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `admin.users.read` | Yes | Yes | Scoped (State) | No | Scoped Read-Only |
| `admin.users.create` | Yes | Subordinate Roles | `ELECTION_OFFICER` in State | No | No |
| `admin.users.update` | Yes | Subordinate Roles | `ELECTION_OFFICER` in State | No | No |
| `admin.users.suspend` | Yes | Subordinate Roles | `ELECTION_OFFICER` in State | No | No |
| `admin.roles.assign` | Yes | Subordinate Roles | No | No | No |
| `admin.scopes.assign` | Yes | Subordinate Roles | Subordinates within State | No | No |
| `elections.read` | Yes | Yes | Scoped (State) | Scoped (Election) | Scoped Read-Only |
| `elections.create` | Yes | Yes | Scoped (State) | No | No |
| `elections.update` | Yes | Yes | Scoped (State) | No | No |
| `elections.manage_status` | Yes | Yes | Scoped (State) | No | No |
| `constituencies.read` | Yes | Yes | Scoped (State) | Scoped | Scoped Read-Only |
| `candidates.read` | Yes | Yes | Scoped (State) | Scoped (Election) | Scoped Read-Only |
| `candidates.manage` | Yes | Yes | Scoped (State) | Scoped (Election) | No |
| `nominations.review` | Yes | Yes | Scoped (State) | Scoped (Election) | No |
| `results.read` | Yes | Yes | Scoped (State) | Scoped (Election) | Scoped Read-Only |
| `results.review` | Yes | Yes | Scoped (State) | No | No |
| `audit.read` | Yes | Yes | Scoped (State) | Scoped | Scoped Read-Only |

---

## 3. Non-Escalation & Authority Invariants

1. **No Self-Privilege Escalation**: Administrators cannot alter their own `role`, `status`, or jurisdiction scopes via `PATCH /api/v1/admin/users/:id`.
2. **Subordinate Authority Cap**: An actor can never create, update, suspend, or activate an administrator at an equal or higher rank (except `SUPER_ADMIN`, who still cannot suspend themselves).
3. **No Empty Auditor Mutations**: `roleHasPermission('READ_ONLY_AUDITOR', perm)` explicitly returns `false` for every permission in `MUTATING_ADMIN_PERMISSIONS`.
