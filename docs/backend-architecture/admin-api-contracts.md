# OVS Phase 8.4 — Administrative API Contracts (`/api/v1/admin`)

All endpoints return standard JSON envelopes (`{ success: true, data, meta: { requestId, timestamp, dataTag } }`) and RFC 9457 Problem Details (`application/problem+json`) on errors. State-changing authenticated endpoints require `Cookie: ovs_session=<token>` and `X-CSRF-Token: <token>`.

## 1. Authentication & Session Management

- **`POST /api/v1/admin/auth/login`**
  - **Auth**: Public (Rate-limited)
  - **Body**: `{ "identifier": "email-or-officer-code", "password": "..." }`
  - **Success (`200`)**: Sets `HttpOnly` cookie `ovs_session`, returns `{ admin, csrfToken }`.
  - **Errors**: `401` (`Invalid administrator credentials.`), `403` (account suspended/deactivated after valid password), `429` (rate limit).
- **`POST /api/v1/admin/auth/logout`** — Auth + CSRF -> revokes current session, clears cookie.
- **`POST /api/v1/admin/auth/logout-all`** — Auth + CSRF -> revokes all sessions for admin, clears cookie.
- **`GET /api/v1/admin/auth/me`** — Auth -> returns `{ admin, csrfToken }` with effective permissions & scopes.
- **`PATCH /api/v1/admin/auth/me`** — Auth + CSRF -> updates `{ fullName?, designation? }` only (`.strict()`).
- **`GET /api/v1/admin/auth/sessions`** — Auth -> returns active sessions (`id`, `userAgent`, `ipAddress`, `lastActivityAt`, `expiresAt`, `isCurrent`).
- **`DELETE /api/v1/admin/auth/sessions/:sessionId`** — Auth + CSRF -> revokes owned session.

## 2. Administrator Account Provisioning & Lifecycle

- **`GET /api/v1/admin/users`** (`admin.users.read` + Jurisdiction Filter)
  - **Query**: `page`, `limit`, `role`, `status`, `stateId`, `search`.
- **`GET /api/v1/admin/users/:id`** (`admin.users.read` + Jurisdiction Check)
  - **Errors**: `403` on cross-state IDOR, `404` if missing.
- **`POST /api/v1/admin/users`** (`admin.users.create` + CSRF + Role Hierarchy + Scope Delegation)
  - **Body**: `{ officerCode, email, fullName, designation, role, password, assignedStateId?, stateIds?, electionIds?, constituencyScopes? }`.
  - **Response (`201`)**: Safe `AdminProfileDto` (no `passwordHash`).
- **`PATCH /api/v1/admin/users/:id`** (`admin.users.update` + CSRF + Role Hierarchy + Scope Delegation)
  - Prevents modifying self role/scopes or higher/equal-rank admins.
- **`POST /api/v1/admin/users/:id/suspend`** (`admin.users.suspend` + CSRF)
  - **Body**: `{ reason, mode?: 'SUSPEND' | 'DEACTIVATE' }`. Revokes all active sessions immediately.
- **`POST /api/v1/admin/users/:id/activate`** (`admin.users.suspend` + CSRF)
  - **Body**: `{ note? }`. Restores active status and clears lockouts.

## 3. Permissions, Jurisdiction Scopes & Audit Inspection

- **`GET /api/v1/admin/permissions`** — Authenticated admin -> returns role-permission matrix and actor permissions.
- **`GET /api/v1/admin/users/:id/scopes`** — Self OR (`admin.users.read` + Jurisdiction Check).
- **`PUT /api/v1/admin/users/:id/scopes`** (`admin.scopes.assign` + CSRF + Delegation Check)
  - **Body**: `{ assignedStateId?, stateIds?, electionIds?, constituencyScopes? }`.
- **`GET /api/v1/admin/audit-logs`** (`audit.read` + Jurisdiction Filter)
  - **Query**: `page`, `limit`, `domain`, `actionType`, `outcome`, `actorRole`, `stateId`, `electionId`. Read-only; no mutation endpoints exist.
- **`GET /api/v1/admin/jurisdictions/states/:stateId`** (`constituencies.read` + `requireJurisdictionScope`)
- **`POST /api/v1/admin/jurisdictions/elections/:electionId/verify-action`** (`nominations.review` + CSRF + `requireJurisdictionScope`)
