# OVS Phase 8.4 — Administrative Authentication Architecture

## 1. Overview & Separation from Voter Authentication

The Online Voting System (OVS) maintains a **strict boundary** between public citizen/voter registration (`POST /api/v1/auth/register`, simulated OTP login) and administrative authentication (`POST /api/v1/admin/auth/login`):

1. **Zero Public Admin Registration**: Public routes never accept `role`, `userType`, `adminUser`, or privilege elevation fields. `registerVoterSchema` uses Zod `.strict()` and `AuthRepository.createVoterUser` hardcodes `userType = 'VOTER'`.
2. **Credential Model**: Administrators authenticate with **Officer Code or normalized Email + high-entropy Password**, hashed using **scrypt** (`N=16384, r=8, p=1`, 16-byte cryptographic salt, PHC format) via Node.js native OpenSSL `node:crypto` and compared using `crypto.timingSafeEqual`.
3. **Unified Session Engine**: Both Voter and Admin portals share the Phase 8.3 opaque server-managed session table (`user_sessions`) and `HttpOnly`, `SameSite=Lax`, `Path=/` cookie (`ovs_session`), storing only the SHA-256 hash of the 256-bit random token in PostgreSQL.

---

## 2. Controlled `SUPER_ADMIN` Bootstrap Process

No default production credentials are ever hardcoded into source files or seeds. Initial `SUPER_ADMIN` provisioning uses [`bootstrapSuperAdmin.ts`](file:///backend/src/modules/admin/bootstrapSuperAdmin.ts):

```bash
# Required environment variables (supplied securely by operator or CI)
BOOTSTRAP_SUPER_ADMIN_CODE="ECI-SUPER-001" \
BOOTSTRAP_SUPER_ADMIN_EMAIL="super@ovs-demo.local" \
BOOTSTRAP_SUPER_ADMIN_NAME="Chief Election Commissioner (Demo)" \
BOOTSTRAP_SUPER_ADMIN_PASSWORD="<12+ char complex password>" \
npm run backend:admin:bootstrap
```

- Enforces the password complexity policy before inserting into `users` and `admin_users` inside a single transaction.
- Safe and idempotent: refuses to overwrite an existing `SUPER_ADMIN` matching the same `officerCode` or `email`.
- Records a `SUPER_ADMIN_BOOTSTRAPPED` audit entry in `admin_action_logs`.

---

## 3. Authentication & Session Lifecycle Flow

```text
Client (Admin Portal)                  Express 5 API                          PostgreSQL
        |                                    |                                     |
        |  POST /api/v1/admin/auth/login     |                                     |
        |  { identifier, password }          |                                     |
        |----------------------------------->|                                     |
        |                                    |  adminLoginLimiter (rate limit)     |
        |                                    |  findAdminByLoginIdentifier()       |
        |                                    |------------------------------------>|
        |                                    |<------------------------------------|
        |                                    |  [Unknown -> simulateVerifyTiming   |
        |                                    |   + log FAILURE -> generic 401]     |
        |                                    |  [Lockout -> simulateVerifyTiming   |
        |                                    |   + log DENIED -> generic 401]      |
        |                                    |  scrypt verifyPassword()            |
        |                                    |  [Wrong -> recordLoginFailure       |
        |                                    |   (lock >= 5) -> generic 401]       |
        |                                    |  [Suspended/Deactivated -> 403]     |
        |                                    |  Revoke prior cookie session (fixation)
        |                                    |  Insert sha256(token) into          |
        |                                    |  user_sessions + ADMIN_LOGIN log    |
        |  200 OK + Set-Cookie: ovs_session  |                                     |
        |  + { data: { admin, csrfToken } }  |                                     |
        |<-----------------------------------|                                     |
```

### Session Expiry & Rotation Rules
- **Absolute Lifetime**: 8 hours (`SESSION_DURATION_MS = 28,800,000`).
- **Idle Inactivity Timeout**: 30 minutes (`SESSION_INACTIVITY_TIMEOUT_MS = 1,800,000`), enforced via `UserSession.lastActivityAt`.
- **Session Fixation Defense**: Any pre-existing `ovs_session` cookie sent with a login request is deleted from `user_sessions` before creating the fresh session.
- **Instant Suspension Revocation**: Suspending or deactivating an admin atomically deletes all active `user_sessions` rows for that user; `authenticateSession` also verifies `adminUser.isActive && adminUser.status === 'ACTIVE'` on every request.
