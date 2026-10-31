# OVS Security Threat Model & Risk Assessment (Phase 8.1.1 Corrected)

## 1. Executive Summary & Legal Boundaries

This document provides a comprehensive security threat model for the Online Voting System (OVS) backend prototype. It evaluates security controls, residual risks, data classification, privacy safeguards, and architectural boundaries using the **STRIDE** methodology and the **OWASP Top 10:2021** vulnerability framework.

> **CRITICAL LEGAL & TECHNICAL NOTICE**:
> This backend is designed exclusively as an **educational demonstration platform**.
> A standard web application architecture (Node.js, Express, PostgreSQL, REST APIs) is **technically and constitutionally insufficient** for conducting legally binding public elections in India.
> Real Indian general elections rely on physical, air-gapped Electronic Voting Machines (EVMs) with physical Voter Verifiable Paper Audit Trails (VVPAT) administered by the Election Commission of India under the *Representation of the People Act, 1951*.
> Any transition toward remote internet voting for real public elections would necessitate statutory parliamentary authorization, specialized end-to-end verifiability (E2E-V) cryptographic proofs, zero-knowledge tallying, verifiable mixnets, and multi-party threshold cryptography.

---

## 2. Data Classification & Privacy Architecture

The OVS backend enforces a strict data classification schema to ensure appropriate storage, field-level encryption, access control, and retention:

| Classification | Examples | Storage & Encryption Controls | Retention / Lifecycle Policy |
| :--- | :--- | :--- | :--- |
| **Public Data** | State names, PC/AC boundaries, party symbols, candidate affidavits, published election results, general announcements | Plaintext in PostgreSQL; cached via CDN; accessible unauthenticated. | Retained indefinitely as public historical electoral records. |
| **Internal Data** | Counting rounds in progress, admin action logs, draft announcements, candidate scrutiny notes | Role-restricted PostgreSQL storage; accessible only to authenticated ECI officers. | Retained across active election lifecycles; archived to cold storage post-audit. |
| **Confidential PII** | Voter full name, EPIC number, date of birth, mobile number, email, home address | Field-level AES-256-GCM encryption at rest for sensitive contact/address fields; masked in UI logs (`XXXXXX1223`). | Retained during active voter registration; anonymized/deleted upon statutory deregistration. |
| **Restricted Secrets** | Password hashes, session tokens, OTP hashes, CSRF tokens | Salted Argon2id / SHA-256 hashes; `HttpOnly` Secure cookies; never logged in audit trails. | Short-lived: OTP challenges purged after 24 hours; expired sessions purged after 7 days. |
| **PROHIBITED** | **Voter Candidate Selections** | **ZERO PERSISTENCE**: Strictly prohibited from existing in any table, column, cache, memory queue, or log. | **NEVER STORED**. |

---

## 3. STRIDE Threat Analysis Matrix

| Threat Category (STRIDE) | Attack Scenario | Mitigating Control in OVS Backend | Residual Risk Level |
| :--- | :--- | :--- | :---: |
| **Spoofing Identity** | Attacker spoofs a registered voter's identity using a scraped EPIC number. | Mandatory Argon2id password verification, 2FA challenge via `auth_challenges`, IP rate limiting, and session rotation. | **Low** (Demo mode uses fixed OTPs; production would use SMS/biometrics) |
| **Tampering with Data** | Malicious officer attempts to modify candidate vote tallies during counting. | Strict role-based authorization; result corrections require immutable `result_correction_history` entries with admin signature. Composite foreign keys `(candidateId, partyId)` prevent party tampering. | **Low** |
| **Repudiation** | Administrator denies executing an unapproved status change or election cancellation. | Append-only `admin_action_logs` capturing officer ID, IP address, timestamp, and sanitized change details. | **Very Low** |
| **Information Disclosure** | Attacker queries database or API to determine which candidate a voter voted for. | **Architectural Impossibility**: `demo_participations` stores zero candidate choices. Tallies reside in completely decoupled tables. | **Zero** (By structural design) |
| **Denial of Service (DoS)** | Script floods login or participation endpoints to exhaust database connection pool. | Express rate limiters, connection pooling limits in Prisma, and pagination limits (`pageSize <= 100`). | **Low** |
| **Elevation of Privilege** | `STATE_ADMIN` attempts to modify elections in another state, or `ELECTION_OFFICER` accesses unauthorized election. | Server-side `requireAdminScope` middleware verifies `targetStateId === admin.assignedStateId` and validates normalized `admin_election_scopes` records. | **Very Low** |

---

## 4. OWASP Top 10 Evaluation & Mitigations

### 4.1 A01: Broken Access Control (BOLA / IDOR)
- **Threat**: An attacker alters `voterId` in `GET /api/v1/voters/:id` to inspect another citizen's registration profile.
- **Mitigation**: Voter routes use contextual paths (`/api/v1/voters/me`) that resolve identity exclusively from the authenticated session token (`req.voter.id`). Parameterized ID lookup is restricted to authorized ECI administrators.
- **Cross-Jurisdiction IDOR Defense**: For administrative routes, the server verifies that `STATE_ADMIN` requests match `admin.assignedStateId`, and `ELECTION_OFFICER` requests match an active entry in `admin_election_scopes`.

### 4.2 A02: Cryptographic Failures
- **Threat**: Exposure of passwords or sensitive identity records in database backups.
- **Mitigation**: Passwords hashed using Argon2id (64 MiB RAM, 3 iterations). TLS 1.3 enforced for data-in-transit. No Aadhaar numbers or unmasked government credentials collected or stored. Field-level AES-256-GCM encryption for voter contact details.

### 4.3 A03: Injection (SQL Injection, CSV Formula Injection)
- **Threat 1 (SQL Injection)**: Malicious input injected into candidate search or filter fields.
  - *Mitigation*: Prisma ORM generates parameterized queries exclusively. Raw SQL queries (`$queryRawUnsafe`) are strictly prohibited in codebase linting.
- **Threat 2 (CSV Formula Injection)**: Attacker submits candidate bio or name prefixed with `=cmd|'/c calc'!A0` to execute arbitrary code when an officer opens result exports in Excel.
  - *Mitigation*: The `escapeCsvCell` service function inspects all export cells and prefixes `=, +, -, @` with a single apostrophe (`'`).

### 4.4 A04: Insecure Design (Ballot Choice Exposure)
- **Threat**: An architecture that links voter accounts to their ballot choices.
- **Mitigation**: Physical and relational decoupling. The `demo_participations` table has zero foreign keys or fields for candidate selection. Candidate tallies in `candidate_tallies` are calculated from independent demo simulation rounds.

### 4.5 A05: Security Misconfiguration
- **Threat**: Verbose error messages exposing server stack traces or database schema.
- **Mitigation**: Global error handler formats all runtime errors into sanitized RFC 9457 Problem Details (`application/problem+json`) responses, suppressing internal stack traces in production (`NODE_ENV === 'production'`).

### 4.6 A07: Identification and Authentication Failures
- **Threat**: Brute-force credential guessing on voter or officer login portals.
- **Mitigation**: Progressive lockout (3 failed attempts -> 5 min lockout; 5 attempts -> 30 min lockout). OTP challenges expire after 120 seconds with max 3 attempts.

---

## 5. Administrative Misuse & Audit Log Integrity

1. **Privilege Segregation**:
   - `READ_ONLY_AUDITOR` cannot execute any state transitions, counting rounds, or data mutations.
   - `STATE_ADMIN` cannot access or modify national political party registries or other states' Assembly elections.
   - `ELECTION_OFFICER` access is strictly bound to explicitly assigned election IDs in `admin_election_scopes`.
   - `SUPER_ADMIN` actions are logged with immutable audit trails.
2. **Audit Log Sanitization**:
   - `admin_action_logs` explicitly redacts sensitive data (passwords, OTP codes, session tokens) before committing to disk.
   - Audit logs cannot be deleted or truncated via the standard API.

---

## 6. Architectural Boundaries: Educational Prototype vs. Legal Public Elections

```text
┌─────────────────────────────────────────────────────────────┐
│                 OVS EDUCATIONAL PROTOTYPE                   │
│  - Purpose: UI/UX, electoral workflows & architecture demo  │
│  - Storage: PostgreSQL with Prisma ORM                      │
│  - Security: Standard web application controls (OWASP)      │
│  - Authentication: Simulated OTP & Password                 │
│  - Status: Strictly non-binding demonstration               │
└─────────────────────────────────────────────────────────────┘
                               ▲
                         CRITICAL CHASM
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               STATUTORY REAL-WORLD ELECTIONS                │
│  - Constitutional Authority: Article 324 of Constitution    │
│  - Statutory Framework: Representation of the People Act    │
│  - Hardware: Standalone air-gapped EVMs + physical VVPAT    │
│  - Cryptography: HSMs, End-to-End Verifiability (E2E-V)     │
│  - Supervision: Physical polling agents & micro-observers   │
└─────────────────────────────────────────────────────────────┘
```
