# OVS Phase 8.4 — Implementation Report: Admin Authentication, RBAC, Jurisdiction Scoping, Audit Controls & CI/CD Alignment

## 1. Executive Summary

Phase 8.4 implements a dedicated, fail-closed administrative authentication, Role-Based Access Control (RBAC), jurisdiction-scope isolation, controlled provisioning, and append-only audit trail system across the backend (`Express 5 + TypeScript + Prisma 6.4.1 + PostgreSQL 16`) and React 19 frontend, together with GitHub Actions CI/CD alignment fixes so automated checks run cleanly on `ubuntu-latest`.

## 2. Database Schema & Forward Migration

- **Prisma Schema**: [`backend/prisma/schema.prisma`](..\..\backend\prisma\schema.prisma)
- **Migration**: [`backend/prisma/migrations/20261111000200_phase_8_4_admin_rbac_scopes_audit/migration.sql`](..\..\backend\prisma\migrations\20261111000200_phase_8_4_admin_rbac_scopes_audit\migration.sql)
- Key structural additions:
  - `AdminStatus` enum (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`) synchronized via `chk_admin_status_active_sync`.
  - `UserSession.lastActivityAt` (`last_activity_at`) for 30-minute idle timeout tracking.
  - `AdminUser` extended with normalized unique `email`, `status`, suspension/deactivation metadata, `createdByAdminId`, and `passwordUpdatedAt`.
  - `AdminStateScope` (`admin_state_scopes`) supporting multi-state assignments for `STATE_ADMIN` / `ELECTION_OFFICER`.
  - `AdminConstituencyScope` (`admin_constituency_scopes`) with polymorphic PC/AC CHECK constraint (`chk_admin_constituency_scope_target`) and partial unique indexes (`uq_admin_constituency_scope_pc`, `uq_admin_constituency_scope_ac`).
  - `AdminActionLog` (`admin_action_logs`) extended with `actorUserId`, `actorIdentifier`, `actorRole`, `outcome` (`chk_admin_action_log_outcome`), `requestId`, and `userAgent`.

> Note: `docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma` remains intentionally unchanged at 25 models and 17 enums to preserve Phase 8.1.x static architecture & trigger verification compatibility.

## 3. Security Architecture & Controls Implemented

1. **Separated Admin Identity & Bootstrap**:
   - Public voter registration (`POST /api/v1/auth/register`) validates strict Zod schemas and never assigns administrative roles (`userType: 'VOTER'`).
   - Initial `SUPER_ADMIN` accounts are provisioned exclusively via [`bootstrapSuperAdmin.ts`](..\..\backend\src\modules\admin\bootstrapSuperAdmin.ts) (`npm run backend:admin:bootstrap`) using explicit arguments/environment variables (no hardcoded production credentials).
2. **Password Hashing & Lockout Protection**:
   - [`password.service.ts`](..\..\backend\src\modules\admin\password.service.ts) uses Node.js `crypto.scrypt` (`N=16384, r=8, p=1`, 16-byte salt, 64-byte key, PHC encoding) with `crypto.timingSafeEqual`.
   - Enforces minimum length (12 chars), character-class complexity, identifier non-inclusion, constant-time dummy verification against user enumeration, progressive failed-login lockouts, and rate limiting on `/api/v1/admin/auth/login`.
3. **Server-Managed Sessions & CSRF**:
   - Reuses HttpOnly `ovs_session` cookie (SHA-256 hashed in `UserSession`), HMAC-SHA256 `X-CSRF-Token`, session-fixation rotation on login, and 30-minute idle expiry.
   - Suspension/deactivation immediately revokes all active sessions for the admin.
4. **Separated RBAC & Jurisdiction Scope Enforcement**:
   - Centralized permissions in [`admin.permissions.ts`](..\..\backend\src\modules\admin\admin.permissions.ts) (`ROLE_PERMISSION_MATRIX`, `ADMIN_ROLE_RANK`, `MUTATING_ADMIN_PERMISSIONS`).
   - `READ_ONLY_AUDITOR` strictly holds zero mutating permissions.
   - `requirePermission(...)` and `requireJurisdictionScope(...)` are independent middleware checks in [`admin.middleware.ts`](..\..\backend\src\modules\admin\admin.middleware.ts); having a permission never bypasses state/election/constituency scope restrictions, and role hierarchy + scope subset rules block privilege escalation.
5. **Sanitized Append-Only Audit Logging**:
   - [`admin.audit.service.ts`](..\..\backend\src\modules\admin\admin.audit.service.ts) recursively redacts secrets (`password`, `passwordHash`, `otp`, `sessionToken`, `csrfToken`, cookies, auth headers) before persistence in `admin_action_logs`.

## 4. Administrative API Surface (`/api/v1/admin`)

Implemented in [`admin.routes.ts`](..\..\backend\src\modules\admin\admin.routes.ts) and [`admin.controller.ts`](..\..\backend\src\modules\admin\admin.controller.ts):
- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/logout`
- `POST /api/v1/admin/auth/logout-all`
- `GET /api/v1/admin/auth/me`
- `PATCH /api/v1/admin/auth/me`
- `GET /api/v1/admin/auth/sessions`
- `DELETE /api/v1/admin/auth/sessions/:sessionId`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/:id`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id`
- `POST /api/v1/admin/users/:id/suspend`
- `POST /api/v1/admin/users/:id/activate`
- `GET /api/v1/admin/permissions`
- `GET /api/v1/admin/users/:id/scopes`
- `PUT /api/v1/admin/users/:id/scopes`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/jurisdictions/states/:stateId`
- `POST /api/v1/admin/jurisdictions/elections/:electionId/verify-action`

## 5. Frontend Integration & Dual-Mode Compatibility

- Preserves `LOCAL_DEMO` (default) compatibility for all existing UI workflows and Playwright specs while integrating `BACKEND_API` mode via [`apiClient.js`](..\..\src\services\apiClient.js), [`AuthContext.jsx`](..\..\src\context\AuthContext.jsx), [`adminPermissionService.js`](..\..\src\services\adminPermissionService.js), [`AdminSidebar.jsx`](..\..\src\components\admin\AdminSidebar.jsx), [`AdminLayout.jsx`](..\..\src\layouts\AdminLayout.jsx), [`Login.jsx`](..\..\src\pages\admin\Login.jsx), [`AuditLogs.jsx`](..\..\src\pages\admin\AuditLogs.jsx), [`AdminProfile.jsx`](..\..\src\pages\admin\AdminProfile.jsx), [`AdminUserManagement.jsx`](..\..\src\pages\admin\AdminUserManagement.jsx), and [`AppRoutes.jsx`](..\..\src\routes\AppRoutes.jsx) (with explicit 403 Forbidden screen).

## 6. CI/CD Fixes Applied

1. **Cross-platform `npm ci` fix (`package.json` + `package-lock.json`)**:
   - Removed the Windows-only `lightningcss-win32-x64-msvc` entry from root `devDependencies` (keeping it strictly inside `lightningcss`'s `optionalDependencies`) and refreshed `package-lock.json`, preventing `EBADPLATFORM` errors on GitHub Actions `ubuntu-latest` runners.
2. **PostgreSQL 16 validation vs Phase 8.4 migration separation (`.github/workflows/ci.yml`)**:
   - Step 11 now pushes `PRISMA_SCHEMA_DRAFT.prisma` and applies `CUSTOM_DATABASE_INTEGRITY.sql` right before Step 12 executes `tests/postgresql-validation.sql` (whose SQL fixtures target the Phase 8.1.6 schema without Phase 8.4's `admin_users.email NOT NULL` column).
   - Step 13 resets the `public` schema and runs `npm run prisma:migrate:deploy` across all migrations (including Phase 8.4), followed by idempotent `prisma:seed`, `backend:test:integration`, and `backend:admin:bootstrap` idempotency checks.
