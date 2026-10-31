# OVS Authentication & Authorization Architecture

## 1. Executive Summary & Design Principles

Authentication and authorization in the Online Voting System (OVS) backend are designed with defense-in-depth, strict role-based access control (RBAC), jurisdictional scoping, and zero trust in client-side claims.

### Core Principles:
1. **Server-Authoritative Enforcement**: Client-side route guards (e.g. `AppRoutes.jsx`) provide UI convenience only. Every backend API route independently validates identity, role membership, and geographic/election scope.
2. **Separation of Voter and Administrative Identities**: Citizen voters authenticate using their EPIC identifier and mobile verification, while ECI Officers authenticate using Officer Codes, high-entropy passcodes, and mandatory two-factor authentication (MFA).
3. **Session Security**: Session tokens are cryptographically random 256-bit values stored in server-side session stores and delivered via secure `HttpOnly`, `SameSite=Strict`, `Secure` cookies.
4. **Honest Distinctions (Educational Demo vs. Production Reality)**:
   - In demonstration mode, OTPs are simulated (`123456`, resend `654321`) to facilitate testing without external SMS gateways.
   - For any theoretical real-world system, Aadhaar e-KYC, physical EVM-VVPAT protocols, hardware security modules (HSM), and cryptographically verifiable mixnets would be legally mandated.

---

## 2. Password & Credential Hashing

### Algorithm: Argon2id
- **Library**: `argon2` Node.js native binding.
- **Parameters**:
  - Memory cost: 65,536 KiB (64 MiB).
  - Time cost: 3 iterations.
  - Parallelism: 4 threads.
  - Salt length: 16 bytes cryptographically random.
- **Rationale**: Argon2id is the winner of the Password Hashing Competition (PHC) and provides state-of-the-art resistance against both GPU-accelerated brute force and side-channel timing attacks.

---

## 3. Session Management & Cookie Architecture

### 3.1 Cookie Specifications
```http
Set-Cookie: ovs_session=s%3A7a1b8c...; Path=/api/v1; Max-Age=28800; HttpOnly; Secure; SameSite=Strict
```
- **`HttpOnly`**: Inaccessible to client JavaScript (`document.cookie`), mitigating Cross-Site Scripting (XSS) session theft.
- **`Secure`**: Enforces transmission exclusively over TLS (HTTPS).
- **`SameSite=Strict`**: Protects against Cross-Site Request Forgery (CSRF) by preventing the browser from sending the cookie in cross-origin contexts.
- **Session Duration**: 8 hours (`OTP_CONFIG.SESSION_DURATION_MS = 28,800,000 ms`).

### 3.2 Session Rotation & Invalidation
- **Login Rotation**: When a user logs in or completes an OTP challenge, any prior session is immediately revoked, and a fresh session ID is issued. This eliminates session fixation vulnerabilities.
- **Explicit Invalidation**: `POST /api/v1/auth/logout` destroys the session record in PostgreSQL / Redis and sends an expired cookie header (`Max-Age=0`).
- **Inactivity Timeout**: Automatic expiration after 30 minutes of inactivity.

---

## 4. Rate Limiting & Account Lockout Defense

### 4.1 Throttling Rules (`express-rate-limit`)
| Route Pattern | Window | Max Requests | Action on Breach |
| :--- | :--- | :--- | :--- |
| `POST /api/v1/auth/login` | 15 minutes | 5 requests per IP / Identifier | 429 Too Many Requests |
| `POST /api/v1/auth/otp/verify` | 5 minutes | 3 attempts per challenge | Challenge revoked, requires re-login |
| `POST /api/v1/demo-participation` | 1 minute | 10 requests per user | 429 Too Many Requests |
| `GET /api/v1/*` (General API) | 1 minute | 120 requests per IP | 429 Too Many Requests |

### 4.2 Progressive Account Lockout
1. 3 consecutive failed credential attempts trigger a 5-minute lockout on the identifier.
2. 5 consecutive failed credential attempts trigger a 30-minute lockout.
3. Every failed attempt is logged with IP and User-Agent in `auth_challenges` and `admin_action_logs`.

---

## 5. Role-Based Access Control (RBAC) & Scoping

The backend implements the 5 ECI administrative roles defined in `adminPermissionService.js`:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPER_ADMIN (CEC Demo)                          │
│   Full national read/write, global demo reset, user & role provisioning │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    NATIONAL_ADMIN (National Election Admin)            │
│   National elections, parties, state definitions (no system reset)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  STATE_ADMIN (State CEO Scoped to stateId)             │
│   State Assembly elections, AC constituencies, candidates in state     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│             ELECTION_OFFICER (RO Scoped to assignedElectionIds)        │
│   Candidate scrutiny, schedule updates, counting simulation rounds     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│               READ_ONLY_AUDITOR (Observer & Auditor)                   │
│   View-only access to all dashboards, audit logs, and integrity audits │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 RBAC Permission Matrix

| Resource / Action | `SUPER_ADMIN` | `NATIONAL_ADMIN` | `STATE_ADMIN` | `ELECTION_OFFICER` | `READ_ONLY_AUDITOR` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **System Demo Reset** | Allowed | Denied | Denied | Denied | Denied |
| **Manage States / UTs** | Allowed | Allowed | Denied | Denied | Denied |
| **Manage Political Parties** | Allowed | Allowed | Denied | Denied | Denied |
| **Manage Lok Sabha Elections** | Allowed | Allowed | Denied | Scoped | Denied |
| **Manage State Assembly Elections**| Allowed | Allowed | Scoped (`stateId`) | Scoped (`electionId`)| Denied |
| **Candidate Scrutiny / Approval** | Allowed | Allowed | Scoped (`stateId`) | Scoped (`electionId`)| Denied |
| **Advance Counting Rounds** | Allowed | Allowed | Scoped (`stateId`) | Scoped (`electionId`)| Denied |
| **Publish Official Results** | Allowed | Allowed | Scoped (`stateId`) | Denied | Denied |
| **View Audit Logs & Integrity Audit**| Allowed | Allowed | Allowed | Allowed | Allowed |

### 5.2 Scope Guard Middleware Implementation Pattern

```typescript
// middleware/authorize.ts
export function requireAdminScope(requiredAction: AdminAction) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const admin = req.adminUser;
    if (!admin) {
      return res.status(403).json({ error: 'ECI Officer credentials required.' });
    }

    // 1. Check Role Permission
    if (admin.role === AdminRole.READ_ONLY_AUDITOR && requiredAction !== AdminAction.READ) {
      return res.status(403).json({ error: 'Read-only auditors cannot perform write operations.' });
    }
    if (admin.role === AdminRole.SUPER_ADMIN) {
      return next(); // Unrestricted
    }

    // 2. Check Geographic Scope (STATE_ADMIN)
    const targetStateId = req.params.stateId || req.body.stateId;
    if (admin.role === AdminRole.STATE_ADMIN) {
      if (targetStateId && targetStateId !== admin.assignedStateId) {
        return res.status(403).json({
          error: `Scope violation: Officer is restricted to state ${admin.assignedStateId}.`
        });
      }
    }

    // 3. Check Election Scope (ELECTION_OFFICER)
    const targetElectionId = req.params.electionId || req.body.electionId;
    if (admin.role === AdminRole.ELECTION_OFFICER) {
      if (targetElectionId && !admin.assignedElectionIds.includes(targetElectionId)) {
        return res.status(403).json({
          error: `Scope violation: Election ${targetElectionId} is not assigned to officer.`
        });
      }
    }

    next();
  };
}
```

---

## 6. Simulated OTP vs. Production Authentication Architecture

| Aspect | Demonstration Mode (Current OVS) | Real Production Requirement (Hypothetical) |
| :--- | :--- | :--- |
| **OTP Delivery** | In-browser / deterministic demo codes (`123456`, `654321`) | Regulated telecom SMS gateway (TRAI DLT registered) / Encrypted Email |
| **Identity Verification** | Client-entered EPIC + self-declared personal data | Statutory Aadhaar e-KYC (UIDAI) / ECI ERONet database direct link |
| **Session Security** | Signed HttpOnly session cookies | FIPS 140-2 Level 3 Hardware Security Module (HSM) tokens + WebAuthn biometric passkeys |
| **Administrative 2FA** | Simulated OTP verification modal | Hardware security keys (YubiKey FIDO2 / TOTP RFC-6238) |
| **Legally Binding Ballots** | Not supported (simulated demo tokens only) | Air-gapped EVM with physical VVPAT paper trail supervised by ECI observers |
