# OVS Phase 8.4 — Jurisdiction Scope Model

## 1. Two-Layer Authorization Architecture

OVS separates **Capability Authorization** (`requirePermission(...)`) from **Jurisdiction Authorization** (`requireJurisdictionScope(...)` + service-level assertions). Having a permission never automatically grants access across every state, election, or constituency.

---

## 2. Database Representation (`backend/prisma/schema.prisma`)

1. **Multi-State Scope (`AdminStateScope` -> `admin_state_scopes`)**:
   - Supports 1-to-many state assignments per administrator (`@@unique([adminUserId, stateId])`), alongside primary `AdminUser.assignedStateId` for backward compatibility.
   - `STATE_ADMIN` accounts are required to hold at least one state assignment.
2. **Election Scope (`AdminElectionScope` -> `admin_election_scopes`)**:
   - Normalized join table binding `ELECTION_OFFICER` (and optional scoped auditors) to specific elections (`@@unique([adminUserId, electionId])`).
3. **Constituency Scope (`AdminConstituencyScope` -> `admin_constituency_scopes`)**:
   - Binds an `ELECTION_OFFICER` to specific Parliamentary (`PARLIAMENTARY`) or Assembly (`ASSEMBLY`) constituencies, optionally scoped to a specific `electionId`.
   - Enforced at the PostgreSQL layer with CHECK constraint `chk_admin_constituency_scope_target` and partial unique indexes (`uq_admin_constituency_scope_pc`, `uq_admin_constituency_scope_ac`).

---

## 3. Enforcement Flow & Examples

```text
Request -> authenticate -> requireAdminAuth -> requireCsrf -> requirePermission(P) -> requireJurisdictionScope(Target) -> Service Layer Re-Check -> Repository Filtered Query
```

- **Cross-State Blocking**: A `STATE_ADMIN` assigned `['WB']` requesting `GET /api/v1/admin/users/:mhAdminId`, `GET /api/v1/admin/users?stateId=MH`, or `GET /api/v1/admin/jurisdictions/states/MH` receives `403 Forbidden` and logs a `JURISDICTION_SCOPE_VIOLATION` (`DENIED`) audit event.
- **Election Officer Isolation**: An `ELECTION_OFFICER` assigned `['LS-2029']` with `WB-PC-KRISHNANAGAR` is permitted on `LS-2029` / `WB-PC-KRISHNANAGAR` and denied (`403 Forbidden`) on `WB-ASSEMBLY-2029` or `MH-PC-MUMBAI-NORTH`.
- **Delegation Containment**: A `STATE_ADMIN` provisioning or scoping an `ELECTION_OFFICER` cannot assign empty/national state scopes (`stateIds: []`), cannot assign out-of-state elections, and cannot assign constituencies outside their state(s).
- **Tampered URL/Body Defense**: Jurisdiction targets extracted from URL params, query strings, or request bodies are strictly validated against the database-backed scopes attached to the authenticated session (`req.adminUser`), never trusting client-supplied role or scope headers.
