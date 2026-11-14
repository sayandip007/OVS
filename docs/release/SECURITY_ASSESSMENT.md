# OVS Comprehensive Security Assessment

**Assessment Date:** November 14, 2026  
**Scope:** Online Voting System (OVS) Full System Integration Baseline  
**Auditor:** Antigravity Internal Architecture & Security Verification  

> [!NOTE]
> This security assessment was conducted using rigorous automated static analysis, architectural threat modeling, permission boundary verification, and integration test suites. It does not constitute an independent, accredited third-party penetration test.

---

## 1. Authentication & Session Security

### 1.1 Session Management & Fixation Protection
- **Session ID Rotation:** Upon successful voter OTP verification or admin credential authentication, the server generates a cryptographically random UUIDv4 session token, terminating any unauthenticated pre-session identifier.
- **Session Expiration:** Voter sessions enforce a 2-hour inactivity TTL and an absolute 12-hour session lifetime. Admin sessions enforce a 30-minute idle timeout.
- **Session Revocation:** Logout invalidates the session in PostgreSQL (`user_sessions` or `admin_sessions`). "Logout All Devices" revokes all active sessions for that user simultaneously. Suspended or deactivated administrators are blocked on subsequent requests.
- **Cookie Security Flags:**
  - `HttpOnly`: Enforced across all authentication tokens, preventing JavaScript XSS exfiltration.
  - `SameSite`: Configured to `Strict` to mitigate cross-site request forgery.
  - `Secure`: Conditionally active based on `NODE_ENV === 'production' || NODE_ENV === 'staging'`.

### 1.2 OTP Generation, Replay & Brute-Force Defense
- **Entropy & Generation:** Generates 6-digit cryptographically random numeric strings using Node.js `crypto.randomInt()`.
- **Hashing & Verification:** Stored in database as HMAC-SHA256 digests. Verification uses constant-time comparison (`crypto.timingSafeEqual`) to eliminate timing side-channel attacks.
- **TTL & Expiry:** OTP challenges expire strictly after 5 minutes (300 seconds).
- **Lockout Policy:** Account challenges enforce a maximum of 3 failed attempts, after which the challenge is invalidated and the account enters a progressive lockout cooldown.
- **Simulated Provider Safety:** In non-development environments, plaintext OTP codes are never logged, returned in API bodies, or exposed to the frontend.

### 1.3 Password Policy & Cryptographic KDF
- **Algorithm:** Node.js native OpenSSL `scrypt` Key Derivation Function (KDF) using parameters $N=16384, r=8, p=1$ producing standard PHC formatted strings (`$scrypt$N=16384,r=8,p=1$<salt>$<hash>`).
- **Complexity Requirements:** Minimum 12 characters, uppercase, lowercase, numeric digit, special character, no leading/trailing whitespace, and actively disallows officer code or email local-part in password string.

---

## 2. Authorization, RBAC & Jurisdiction Boundaries

### 2.1 Role-Based Access Control (RBAC) Matrix
The centralized permission registry (`backend/src/modules/admin/admin.permissions.ts`) strictly defines access for all 5 administrative roles:

| Role | Permitted Scope | Mutation Authority | Account Management |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | Global / All Jurisdictions | Full administrative and operational mutation | Yes |
| **NATIONAL_ADMIN** | National Scope (All States) | Elections, candidates, parties, announcements | No |
| **STATE_ADMIN** | Assigned State Only | State-scoped elections, nominations, analytics | No |
| **ELECTION_OFFICER** | Assigned Election / AC / PC | Scrutiny review, tally verification, counting | No |
| **READ_ONLY_AUDITOR**| Global / Scoped | **Zero mutation authority** (Read-Only) | No |

### 2.2 Lateral & Vertical Escalation Prevention
- **Insecure Direct Object Reference (IDOR):** Voter endpoints (`/api/v1/voters/me`, `/api/v1/voter/participation`) resolve user identity strictly from the authenticated session context (`req.user.id`), never from client-supplied URL parameters or body fields.
- **Cross-State Authorization:** `STATE_ADMIN` operations are intercepted by `requireJurisdiction({ allowStateAdmin: true })`. If a `STATE_ADMIN` attempts to modify an election or candidate belonging to another state, the request is rejected with `HTTP 403 Forbidden`.
- **Auditor Mutation Lockdown:** All mutating endpoints verify that the user's role possesses write permissions. `READ_ONLY_AUDITOR` lacks membership in `MUTATING_ADMIN_PERMISSIONS` and is blocked from any state-modifying action.

---

## 3. API & Web Perimeter Security

### 3.1 Input Validation & Strict Schema Enforcement
- All incoming requests (params, query, body) are validated using Zod schemas configured with `.strict()`.
- Unknown properties or privilege-injection attempts (e.g. injecting `role: 'SUPER_ADMIN'` in voter registration) are rejected with `HTTP 422 Unprocessable Content` (RFC 9457 Problem Details).

### 3.2 Web Security Headers (Helmet & Nginx)
- **Content-Security-Policy (CSP):** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`.
- **Anti-Clickjacking:** `X-Frame-Options: DENY`.
- **MIME Sniffing Prevention:** `X-Content-Type-Options: nosniff`.
- **Referrer Policy:** `strict-origin-when-cross-origin`.
- **Permissions Policy:** Restricts camera, microphone, and geolocation access.

### 3.3 Rate Limiting & DoS Mitigation
- Express global rate limiter enforces a default threshold of 120 requests per minute per IP.
- Authentication endpoints enforce strict per-IP and per-EPIC attempt limits.
- Nginx reverse proxy buffers incoming requests, protecting Node.js worker event loops from slowloris attacks.

### 3.4 Injection Defense
- **SQL Injection:** 100% of database interactions utilize Prisma ORM parameterized queries or strictly typed Prisma methods. Zero raw string concatenation exists in application query paths.
- **CSV Formula Injection:** `AnalyticsExportService` neutralizes formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) by prepending a single quote (`'`) to cell strings.
- **Cross-Site Scripting (XSS):** React auto-escapes rendered values; backend output types are strictly structured JSON.

---

## 4. Database Security & Concurrency Controls

### 4.1 Referential Integrity & Database Triggers
- PostgreSQL composite foreign keys and custom PL/pgSQL procedural triggers enforce business invariants at the database level:
  - `prevent_earlier_round_updates()`: Earlier counting rounds become strictly immutable upon advancing rounds.
  - `verify_candidate_tally_insert()`: Candidate tallies must belong to active counting sessions with approved nominations.
  - `verify_tie_resolution_insert()`: Requires at least 2 top tied candidates with equal non-zero vote counts and approved documentation.

### 4.2 Race Conditions & Concurrency Controls
- **Advisory Locking:** Candidate nominations utilize transaction-scoped PostgreSQL advisory locks (`pg_advisory_xact_lock`) to serialize concurrent submissions and prevent exceeding constituency nomination limits.
- **Optimistic Concurrency Control:** Platform system settings maintain version numbers. Updates verify `expectedVersion` matches the current version, aborting with `HTTP 409 Conflict` on concurrent modification collisions.
- **Unique Participation Constraint:** `DemoParticipation` enforces `@@unique([voterId, electionId])`. Concurrent vote attempts generate a database unique constraint violation (P2002), which the service translates cleanly to an idempotent response or `HTTP 409 Conflict`.

---

## 5. Security Summary & Residual Risk Analysis

| Threat Category | Applied Mitigation | Residual Risk |
| :--- | :--- | :--- |
| **Voter Preference De-anonymization** | Zero candidate choice storage or transmission anywhere in the system. | **None** (Mathematically impossible) |
| **Brute-Force Credential Stuffing** | Scrypt PHC hashing, rate limiting, and OTP lockout thresholds. | Low (Standard internet baseline) |
| **Administrative Privilege Escalation** | Centralized server-side RBAC, non-escalation hierarchy, audit logging. | Low (Requires root DB access) |
| **Malicious Export Spreadsheets** | RFC 4180 formula neutralization on all string fields. | Low |
