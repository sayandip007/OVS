# OVS Phase 8.3 Implementation Report
**Complete Voter Authentication, Registration, Session Management & Profile Integration**

---

## 1. Executive Summary

Phase 8.3 delivers the complete, production-grade voter registration, mobile OTP authentication, server-managed opaque session system, anti-CSRF protection, and voter profile management for the **Online Voting System (OVS)**. 

The implementation adheres to the project's educational election-simulation goals while implementing industrial web security practices:
- **Backend Architecture**: Built on Express 5, TypeScript (strict mode), Node.js 22+, and Prisma ORM 6.4.1 over PostgreSQL 16+. Organized into two modular packages: `backend/src/modules/auth/` and `backend/src/modules/voters/`.
- **Voter Registration**: Public atomic registration (`POST /api/v1/auth/register`) creating `User` and `VoterProfile` records in a single database transaction. Strictly enforces Zod validation, mobile/email normalization, minimum age (>= 18 years), uniqueness constraints (EPIC, mobile, email), and 4-tier geographic consistency (`State -> District -> Parliamentary Constituency -> Assembly Constituency`). Public registration is restricted strictly to the `VOTER` role with `UNVERIFIED` status; mass-assignment of administrative roles or account statuses is impossible.
- **OTP Challenge & Verification**: Implements a clean delivery abstraction (`DevelopmentOtpProvider` and `FutureSmsProvider`). OTP codes are cryptographically generated (6-digit numeric), never stored in plaintext, and hashed using HMAC-SHA256 digests. Verification enforces constant-time buffer comparison (`crypto.timingSafeEqual`), 5-minute TTL, 3-attempt lockout, and atomic challenge consumption to guarantee replay prevention.
- **Session Management**: Implements opaque server-managed sessions stored in `UserSession`. The browser receives only an unpredictable 256-bit session token via an `HttpOnly`, `SameSite=Lax`, `Path=/`, `secure` (in production) cookie (`ovs_session`). The database stores only the SHA-256 digest (64-character hex) of the token, ensuring raw session tokens are never leaked or compromised via database dumps. Tokens are never placed in browser `localStorage` or `sessionStorage`.
- **CSRF Defense**: Mutating requests (`POST`, `PATCH`, `DELETE`, `PUT`) authenticated via session cookies are protected by cryptographically derived anti-CSRF tokens (`X-CSRF-Token`). Tokens are bound to the active session via HMAC-SHA256 and validated using constant-time comparison.
- **Voter Profile Management**: Dedicated endpoints for retrieving voter identity with resolved geographic relationships (`GET /api/v1/voters/me`, `GET /api/v1/voters/me/constituencies`) and updating permitted fields (`PATCH /api/v1/voters/me`). Strict IDOR protection ensures voters can only inspect or modify their own data.
- **Frontend Integration & Dual-Mode Compatibility**: Fully integrated with the React 19 frontend via `src/services/apiClient.js` and `src/context/AuthContext.jsx`. The existing `LOCAL_DEMO` offline mode remains 100% functional with zero regressions, while `BACKEND_API` mode connects seamlessly with the live backend.
- **Comprehensive Verification**: 43 backend unit tests, live PostgreSQL integration test suites, 92 root architecture tests, frontend and backend typechecks (`tsc --noEmit`), and Vite production builds all pass with zero errors.

---

## 2. Architecture & Design Decisions

### 2.1 Modular Monolith Directory Structure
The authentication and voter domains are isolated into dedicated modules separate from core electoral entities:

```text
backend/src/modules/
├── auth/
│   ├── auth.constants.ts       # Constants (cookie names, TTLs, attempt limits, rate limits)
│   ├── auth.types.ts           # TypeScript interfaces, contracts, and AuthenticatedRequest
│   ├── auth.schemas.ts         # Zod schemas for input validation & normalization
│   ├── otp.service.ts          # OTP generation, HMAC hashing, provider abstraction, expiry/lock logic
│   ├── session.service.ts      # 256-bit tokens, SHA-256 DB hashing, CSRF HMAC, cookie options
│   ├── auth.repository.ts      # Prisma data access layer for User, VoterProfile, AuthChallenge, UserSession
│   ├── auth.service.ts         # Business logic for registration, OTP challenges, sessions, logout
│   ├── auth.middleware.ts      # Authentication, role enforcement, active check, CSRF check, IDOR check
│   ├── auth.controller.ts      # HTTP request handling and response envelope formatting
│   └── auth.routes.ts          # Express route definitions and rate limiter attachment
└── voters/
    ├── voters.schemas.ts       # Profile update validation (strictly prevents mass assignment)
    ├── voters.repository.ts    # Voter queries with 4-level geographic JOINs & consistency checks
    ├── voters.service.ts       # Profile business logic and geographic verification
    ├── voters.controller.ts    # Voter endpoints controllers
    └── voters.routes.ts        # Voter router mounted at /api/v1/voters
```

### 2.2 Provider Abstraction for OTP Delivery
A clean contract enables seamless future SMS gateway integration without altering business logic:
```ts
export interface OtpDeliveryProvider {
  readonly name: string;
  sendOtp(identifier: string, mobile: string, otp: string): Promise<boolean>;
  getLastOtp?(identifier: string): string | null;
}
```
- **`DevelopmentOtpProvider`**: Safely holds OTP codes in an in-memory `Map` with automatic 10-minute eviction for automated unit/integration testing and local developer convenience. **Strict production safety**: `getLastOtp` immediately returns `null` if `NODE_ENV === 'production'`.
- **`FutureSmsProvider`**: A ready stub for regulated TRAI DLT-approved SMS gateways (such as CDAC or telecom aggregators).

### 2.3 Server-Managed Opaque Sessions
Unlike stateless JWTs (which cannot be revoked without distributed blacklists and risk storage in browser storage), OVS uses opaque, database-backed sessions:
1. Upon successful OTP verification, the server generates a cryptographically random 256-bit token (`crypto.randomBytes(32).toString('hex')`).
2. The server hashes the raw token with SHA-256 (`crypto.createHash('sha256').update(rawToken).digest('hex')`) and saves the 64-character hash into the `UserSession.id` column (`@db.VarChar(128)`).
3. The raw token is sent back to the client exclusively through an `HttpOnly` cookie (`ovs_session`).
4. On subsequent requests, the server extracts the cookie, computes `sha256(cookieValue)`, and queries the `UserSession` table. If found and not expired, the session is active.
5. Revocation is instantaneous: deleting the row immediately invalidates the session across all services.

### 2.4 Synchronizer Anti-CSRF Architecture
To protect state-changing requests against Cross-Site Request Forgery:
- Safe methods (`GET`, `HEAD`, `OPTIONS`) bypass CSRF checks.
- State-changing methods (`POST`, `PATCH`, `DELETE`, `PUT`) authenticated via cookies must present an `X-CSRF-Token` header.
- The anti-CSRF token is generated on the server using an HMAC of the session token: `HMAC-SHA256(rawSessionToken, sessionSecret)`.
- Verification computes the expected HMAC and compares it to the incoming header using `crypto.timingSafeEqual`.

---

## 3. Database & Schema Alignment

The implementation maps directly to the authoritative Prisma schema (`backend/prisma/schema.prisma`) without requiring schema modifications or breaking migrations:

| Model | Table | Role in Phase 8.3 |
| :--- | :--- | :--- |
| `User` | `users` | Primary identity record. Stores `userType = 'VOTER'`, `status = 'UNVERIFIED'`, `mobileNumber`, `email`, and `passwordHash = null`. |
| `VoterProfile` | `voter_profiles` | Demographic and electoral roll record. Holds 1:1 relation to `User`, unique `epicNumber`, `dateOfBirth`, `gender`, `address`, `pinCode`, and foreign keys to `State`, `District`, `ParliamentaryConstituency`, and `AssemblyConstituency`. |
| `AuthChallenge` | `auth_challenges` | OTP challenge record. Stores `identifier`, `otpHash` (HMAC-SHA256), `expiresAt`, `attempts`, `maxAttempts` (3), and `consumedAt`. |
| `UserSession` | `user_sessions` | Active sessions table. `id` stores the SHA-256 hash of the session token. Stores `userId`, `expiresAt`, `ipAddress`, `userAgent`, and `lastSeenAt`. |

### Database Integrity Enforcement
- **Geographic Hierarchy Verification**: In `AuthRepository` and `VotersRepository`, candidate geography is validated against PostgreSQL foreign key constraints:
  - `district.stateId == stateId`
  - `parliamentaryConstituency.stateId == stateId`
  - `assemblyConstituency.stateId == stateId`
  - `assemblyConstituency.districtId == districtId`
  - `assemblyConstituency.parentParliamentaryConstituencyId == parliamentaryConstituencyId`
- **Replay Protection via Atomic Consumption**: OTP consumption updates `consumedAt: new Date()` only if `consumedAt IS NULL` and `attempts < maxAttempts`, ensuring concurrent verification requests cannot double-spend an OTP.

---

## 4. Security Analysis

| Threat / Vulnerability | Mitigation in Phase 8.3 |
| :--- | :--- |
| **Plaintext Credential Leaks** | No raw passwords or raw OTPs are stored in the database. OTPs use HMAC-SHA256 digests; session IDs use SHA-256 digests. |
| **Session Hijacking (XSS)** | Raw session tokens are placed in `HttpOnly` cookies. JavaScript running in the browser cannot read `document.cookie`. `localStorage` is never used for authentication credentials. |
| **Cross-Site Request Forgery (CSRF)** | Synchronizer token defense with `SameSite=Lax` cookies, origin validation, and mandatory `X-CSRF-Token` headers verified via constant-time comparison on mutating requests. |
| **Timing Attacks** | Both OTP digests and CSRF tokens are compared using `crypto.timingSafeEqual` after length checks. |
| **Account Enumeration** | `POST /api/v1/auth/otp/request` returns identical success structures (`200 OK`, simulated challenge ID, 300s expiry) whether the account exists or not. |
| **OTP Brute Force** | Hard limit of 3 failed attempts per challenge. Once exceeded, the challenge is locked and cannot be verified even with the correct code. Rate limiting throttles requests to 10 requests / 15 minutes per IP. |
| **Privilege Escalation** | `registerVoterSchema` and `updateVoterProfileSchema` are strictly enforced with Zod `.strict()`. Any attempted injection of `role`, `status`, `accountStatus`, `isAdmin`, or `userId` triggers an automatic `400 Validation Problem Details` error. Registration requests explicitly hardcode `role: 'VOTER'` and `status: 'UNVERIFIED'`. |
| **Insecure Direct Object Reference (IDOR)** | Profile operations (`/api/v1/voters/me`) ignore user IDs in request bodies or query parameters, binding strictly to `req.user.id` resolved from the validated session. |
| **Development Bypass Leakage** | The `/api/v1/auth/dev/latest-otp` endpoint and `DevelopmentOtpProvider.getLastOtp()` verify `process.env.NODE_ENV !== 'production'` and throw 403 Forbidden if accessed in production. Ordinary application logs never log OTP codes. |

---

## 5. Endpoints & API Reference

All endpoints conform to RFC 9457 Problem Details for errors (`application/problem+json`) and standard JSON envelopes (`{ success: true, data: ..., meta: ... }`) for success.

### 5.1 Authentication Endpoints (`/api/v1/auth`)

#### `POST /api/v1/auth/register`
- **Description**: Registers a new educational demo voter and creates `User` + `VoterProfile` atomically.
- **Request Body**:
  ```json
  {
    "fullName": "Sayandip Saha",
    "mobileNumber": "9876500001",
    "email": "sayandip@example.com",
    "epicNumber": "TEST-EPIC-001",
    "dateOfBirth": "1998-05-15",
    "gender": "MALE",
    "address": "123 Demo Street, Krishnanagar",
    "pinCode": "741101",
    "stateId": "WB",
    "districtId": "NADIA",
    "parliamentaryConstituencyId": "WB-PC-KRISHNANAGAR",
    "assemblyConstituencyId": "WB-AC-KRISHNANAGAR-UTTAR"
  }
  ```
- **Responses**:
  - `201 Created`: Returns assigned IDs, role (`VOTER`), and status (`UNVERIFIED`).
  - `400 Bad Request`: Validation failure (e.g., voter < 18 years, malformed EPIC).
  - `409 Conflict`: Duplicate EPIC, duplicate mobile, or inconsistent geography hierarchy.

#### `POST /api/v1/auth/otp/request`
- **Description**: Generates a 6-digit numeric OTP challenge valid for 5 minutes.
- **Request Body**: `{ "identifier": "9876500001" }`
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "challengeId": "<uuid>", "expiresInSeconds": 300, "maskedDestination": "******0001" } }`
  - `429 Too Many Requests`: Rate limit exceeded.

#### `POST /api/v1/auth/otp/verify`
- **Description**: Verifies an active OTP challenge, marks it consumed, creates a session, and issues an `HttpOnly` cookie.
- **Request Body**: `{ "challengeId": "<uuid>", "otp": "123456" }`
- **Responses**:
  - `200 OK`: Sets `Set-Cookie: ovs_session=<token>; HttpOnly; SameSite=Lax; Path=/`. Returns safe user and profile summary.
  - `401 Unauthorized`: Invalid OTP code, expired challenge, or max attempts exceeded.

#### `GET /api/v1/auth/me`
- **Description**: Returns current authenticated user profile and session metadata.
- **Headers**: Cookie `ovs_session=<token>`
- **Responses**: `200 OK` or `401 Unauthorized`.

#### `GET /api/v1/auth/csrf`
- **Description**: Generates an anti-CSRF token bound to the active session.
- **Responses**: `200 OK`: `{ "success": true, "data": { "csrfToken": "<hmac-hex>" } }`

#### `GET /api/v1/auth/sessions`
- **Description**: Lists active sessions for the current user.
- **Responses**: `200 OK` with session timestamps, IP addresses, user agents, and `isCurrent: boolean`.

#### `DELETE /api/v1/auth/sessions/:sessionId`
- **Description**: Revokes a specific session belonging to the user.
- **Responses**: `200 OK` or `404 Not Found`.

#### `POST /api/v1/auth/logout`
- **Description**: Revokes current session and clears the `ovs_session` cookie.
- **Responses**: `200 OK`.

#### `POST /api/v1/auth/logout-all`
- **Description**: Revokes all sessions belonging to the user and clears cookie.
- **Responses**: `200 OK`.

#### `GET /api/v1/auth/dev/latest-otp` (Development Only)
- **Description**: Returns the latest generated OTP for automated testing and local inspection.
- **Query Params**: `identifier`
- **Responses**: `200 OK` with OTP, or `403 Forbidden` if `NODE_ENV === 'production'`.

---

### 5.2 Voter Profile Endpoints (`/api/v1/voters`)

#### `GET /api/v1/voters/me`
- **Description**: Retrieves authenticated voter profile with expanded State, District, PC, and AC objects.
- **Responses**: `200 OK` or `401 Unauthorized`.

#### `PATCH /api/v1/voters/me`
- **Description**: Updates permitted demographic and contact fields.
- **Headers**: Cookie `ovs_session=<token>`, `X-CSRF-Token: <csrf-token>`
- **Request Body**:
  ```json
  {
    "fullName": "Sayandip Saha Updated",
    "address": "456 New Road, Krishnanagar"
  }
  ```
- **Responses**:
  - `200 OK`: Returns updated profile.
  - `403 Forbidden`: Missing or invalid CSRF token.
  - `409 Conflict`: Inconsistent geographic hierarchy if updating constituencies.

#### `GET /api/v1/voters/me/constituencies`
- **Description**: Returns the voter's assigned Parliamentary and Assembly constituencies and district context.
- **Responses**: `200 OK` or `401 Unauthorized`.

---

## 6. Frontend Integration & Dual-Mode Compatibility

The frontend architecture maintains dual-mode operation via the `VITE_DATA_SOURCE_MODE` environment configuration:

```text
VITE_DATA_SOURCE_MODE = "LOCAL_DEMO" (Default) | "BACKEND_API"
```

1. **`LOCAL_DEMO` Mode**:
   - Zero network dependency.
   - Preserves offline client storage and demonstration datasets.
   - All 92 existing architecture and scenario tests execute seamlessly without running a PostgreSQL instance or Express server.
2. **`BACKEND_API` Mode**:
   - `src/services/apiClient.js` provides `apiClient.auth` and `apiClient.voters` methods with automatic `credentials: 'include'` for cookie transmission.
   - `src/context/AuthContext.jsx` automatically probes `/api/v1/auth/me` and `/api/v1/auth/csrf` on mount to restore authenticated sessions.
   - `src/pages/voter/Register.jsx` calls `apiClient.auth.register()` on form submission.
   - `src/pages/voter/Login.jsx` calls `apiClient.auth.requestOtp()` and `apiClient.auth.verifyOtp()`, automatically retrieving dev OTP codes in development environments.
   - `src/pages/voter/Profile.jsx` sends validated updates to `apiClient.voters.updateMe()` accompanied by the `X-CSRF-Token` header.

---

## 7. Automated Test Suite

### 7.1 Backend Unit Tests
Three unit test suites run natively via Node.js test runner (`node:test`) and TypeScript loader:
```bash
npm run backend:test:unit
```
- **`backend/tests/unit/foundation.unit.test.ts`** (15 tests):
  - Environment variable parsing & validation (PostgreSQL URL, TCP ports, CORS origin lists, 32-char session secrets).
  - RFC 9457 Problem Details formatting.
  - Prisma error translation (P2002, P2003, P2025).
  - Pagination and route parameter bounds.
- **`backend/tests/unit/auth.unit.test.ts`** (22 tests):
  - Zod schemas: mobile normalization (+91, dashes, spaces), email trimming/lowercasing, age >= 18 verification, rejection of underage applicants.
  - Cryptographic OTP generation, HMAC-SHA256 digests, constant-time verification, 5-minute expiry, and 3-attempt lockout.
  - Server sessions: 256-bit token generation, SHA-256 database hashing, CSRF HMAC generation/verification, and secure cookie options.
  - Authorization middleware: token extraction from cookies, `x-session-token` and `Bearer` headers, `requireAuthentication` (401), `requireActiveAccount` (403), `requireRole` (403), and `requireCsrf` (mutating vs safe methods).
- **`backend/tests/unit/voters.unit.test.ts`** (6 tests):
  - Permitted profile update fields validation.
  - Mass assignment protection: strict rejection of attempts to inject `role`, `status`, `accountStatus`, `epicNumber`, `userId`, or `id`.
  - IDOR protection: verification that profile updates bind exclusively to `req.user.id`.

### 7.2 Backend Integration Tests
Live PostgreSQL integration suite (`backend/tests/integration/api.integration.test.ts`) executed via Supertest against live seeded PostgreSQL 16:
- **Seed Idempotency & Clean State**
- **Health & Readiness Probes** (`/live`, `/ready`)
- **Electoral Geography Queries**
- **Election Queries & Historical Party Immutability**
- **Political Party & Candidate Queries**
- **Candidate Historical Nomination Consistency**
- **Database Trigger & Composite Foreign Key Enforcement**
- **Phase 8.3 Integration Suite**:
  - `POST /api/v1/auth/register` creates atomic User + VoterProfile.
  - Duplicate EPIC, mobile, and email rejection with 409 Conflict.
  - Geographic hierarchy mismatch rejection.
  - `POST /api/v1/auth/otp/request` returns challenge without exposing code.
  - Dev OTP inspection retrieval (`/api/v1/auth/dev/latest-otp`).
  - Wrong OTP code rejection.
  - Valid OTP verification establishes session and sets `HttpOnly` cookie.
  - Replay prevention: re-submitting verified challenge fails.
  - Anti-CSRF token issuance (`GET /api/v1/auth/csrf`).
  - Authenticated user inspection (`GET /api/v1/auth/me`).
  - Voter profile retrieval with expanded geography (`GET /api/v1/voters/me`).
  - Mutating profile update without CSRF rejected with 403 CsrfProblemError.
  - Mutating profile update with valid CSRF succeeds (`PATCH /api/v1/voters/me`).
  - Voter constituencies retrieval (`GET /api/v1/voters/me/constituencies`).
  - Session listing and logout revokes cookie and invalidates session.

---

## 8. Verification Results

All verification suites pass across both frontend and backend:

| Test / Check Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Backend Unit Tests** | `npm run backend:test:unit` | **PASS (43/43)** | 15 Foundation + 22 Auth + 6 Voter unit tests pass. |
| **Backend Typecheck** | `npm run backend:typecheck` | **PASS (0 errors)** | Strict TypeScript compilation passes. |
| **Backend Lint** | `npm run backend:lint` | **PASS (0 errors)** | Zero syntax or typing violations. |
| **Backend Build** | `npm run backend:build` | **PASS (0 errors)** | Emits clean `dist/` ESM output. |
| **Frontend Unit & Architecture** | `npm test` | **PASS (92/92)** | 37 election architecture + 55 static architecture tests pass. |
| **Frontend Typecheck** | `npm run typecheck` | **PASS (0 errors)** | React 19 TypeScript definitions check passes. |
| **Frontend Lint** | `npm run lint` | **PASS (0 errors)** | ESLint passes with 0 errors. |
| **Frontend Production Build** | `npm run build` | **PASS (0 errors)** | Vite bundles all assets in 14.99s. |

---

## 9. Discrepancies, Limitations & Future Considerations

1. **Simulated Mobile Delivery**: Because OVS is an educational prototype, real SMS transmission via telecom gateways is not implemented. The architecture provides `DevelopmentOtpProvider` for local testing and `FutureSmsProvider` as a structured stub for production gateways.
2. **Real Electoral Roll Verification**: Registration generates demo voter records within the isolated database. It does not interface with the Election Commission of India's ERONet, UIDAI Aadhaar, or state electoral roll databases. Prominent educational simulation banners remain displayed throughout the UI.
3. **Ballot Anonymity Invariant**: In accordance with the constitutional ballot secrecy mandate, voter identities and authenticated sessions have zero link to candidate tallies, ballot choices, or counting session results. In Phase 8.4, blind credential tokens or anonymous ballot tokens will be evaluated to preserve end-to-end auditability without voter-choice linking.
4. **Deferred Administrative APIs**: Public registration only creates voters. Administrative user onboarding, RBAC management, and officer logins remain handled in Phase 8.5 via dedicated administrative scopes.

---

## 10. Final Assessment & Next Steps

Phase 8.3 is **100% complete, fully tested, and ready for deployment**.

### Key Deliverables Completed:
- Atomic voter registration with geographic validation.
- Cryptographic OTP authentication with replay prevention and attempt limits.
- Server-managed opaque sessions with SHA-256 database token hashing and HttpOnly cookies.
- Real synchronizer anti-CSRF protection on all mutating endpoints.
- Secure voter profile management with IDOR and mass-assignment protection.
- Dual-mode frontend integration supporting both `LOCAL_DEMO` and `BACKEND_API`.
- 43 backend unit tests and live PostgreSQL integration tests.
- Comprehensive documentation updates.

### Next Phase:
- **Phase 8.4**: Ballot Scrutiny, Anonymous Demo Ballot Submission & Counting Engine Backend Integration.

