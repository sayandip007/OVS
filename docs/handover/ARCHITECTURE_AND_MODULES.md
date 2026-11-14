# OVS Architecture & Modules Blueprint

**System:** Online Voting System (OVS)  
**Architecture Style:** Layered Service Architecture with Dual-Mode Frontend Integration  
**Backend Framework:** Express 5 / Node.js 22 LTS / TypeScript 5.8  
**ORM / Data Store:** Prisma ORM / PostgreSQL 16  

---

## 1. High-Level Architectural Topology

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT 19 SPA (FRONTEND)                         │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │   Dual-Mode Runtime Adapter (`VITE_DATA_SOURCE_MODE`)          │   │
│   │   ├── LOCAL_DEMO Mode (Browser LocalStorage + Mock Services)    │   │
│   │   └── BACKEND_API Mode (apiClient.js -> REST endpoints)        │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / HTTPS (REST JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      EXPRESS 5 TYPESCRIPT BACKEND                      │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Global Security & Middlewares:                                 │   │
│   │ Helmet (CSP, HSTS), CORS, Rate Limiter, CookieParser, CSRF     │   │
│   │ Pino Request Logger, Health Probes (/health, /ready, /metrics) │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │ Core Modular Domain Services:                                  │   │
│   │ • Auth & Voter Identity Module                                 │   │
│   │ • Admin RBAC & Jurisdiction Scoping Engine                     │   │
│   │ • Election Lifecycle & Constituency Assignment                 │   │
│   │ • Candidate & Nomination Scrutiny Workflow                     │   │
│   │ • Secret Ballot & Participation Recording (Strict Anonymity)   │   │
│   │ • Independent Synthetic Counting & Tie Resolution              │   │
│   │ • Election Analytics, Dashboards & RFC 4180 CSV Export         │   │
│   │ • Notifications, Announcements & Targeted Outbox               │   │
│   │ • System Settings, Feature Flags & Maintenance Controls        │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ Prisma ORM Connection Pool
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   POSTGRESQL 16 RELATIONAL DATABASE                    │
│   • 28 Relational Models (schema.prisma)                               │
│   • Native SQL Integrity Triggers (CUSTOM_DATABASE_INTEGRITY.sql)      │
│   • Multi-Tenant Constraints, Foreign Keys & Advisory Locks            │
│   • Immutable Audit Trails & Historical Snapshots                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Backend Modules

### 1. Admin Authentication & RBAC Engine (`src/modules/admin/`)
- Password hashing with scrypt PHC (32-byte salt, $N=16384, r=8, p=1$).
- Session fixation protection: regenerates session identifiers upon login/logout.
- Permission evaluation: `roleHasPermission()` checks central permission matrix.
- Jurisdiction evaluation: `evaluateJurisdictionAccess()` enforces state and constituency limits.
- Immutable audit trail: `admin_audit_logs` records all mutating operations with recursive secret redaction.

### 2. Voter Identity & Session Module (`src/modules/auth/` & `src/modules/voter/`)
- Synthetic OTP challenge verification using HMAC-SHA256 constant-time comparison.
- Strict personal and geographic profile binding.
- Anti-enumeration login lockout: uniform simulated delays on invalid credentials.

### 3. Election & Constituency Management (`src/modules/election/`)
- Supports `LOK_SABHA` (Parliamentary Constituencies across states) and `STATE_ASSEMBLY` (Assembly Constituencies within designated state).
- Multi-milestone scheduling: enforces chronological sequence from `NOMINATION_OPEN` to `RESULT_PUBLICATION`.
- Configuration review state machine: `DRAFT -> SUBMITTED_FOR_REVIEW -> APPROVED`.

### 4. Candidate & Nomination Scrutiny (`src/modules/candidates/`)
- Party affiliation management: party symbol registration and independent candidate handling.
- Nomination lifecycle: `DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED | REJECTED -> WITHDRAWN`.

### 5. Secret Ballot & Zero-Knowledge Participation (`src/modules/voting/`)
- **Voter Privacy Invariant:** Candidate choices are kept strictly in volatile React component state.
- Backend request schema: `participationConfirmBodySchema = z.object({}).strict()` rejects any payload containing candidate choice with HTTP 422.
- Records atomic participation in `DemoParticipation` with unique constraint `(voterId, electionId)`.

### 6. Independent Synthetic Counting (`src/modules/counting/`)
- Multi-round tally reconciliation completely isolated from individual voters.
- Tie detection trigger: switches session status to `TIED` when top tallies match.
- Statutory tie resolution: records immutable `TieResolution` audit record and advances session to `RESULT_READY_FOR_REVIEW`.

### 7. Analytics & Data Export (`src/modules/analytics/`)
- Small constituency privacy protection: masks participation counts $< 5$ to prevent voter re-identification.
- Formula injection protection: quotes cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` before RFC 4180 CSV generation.

### 8. System Administration & Feature Flags (`src/modules/system-settings/`)
- Global maintenance interceptor: intercepts voter traffic with HTTP 503 while permitting `/health` and admin access.
- Feature flags with percentage rollout and role targeting.
- Optimistic concurrency control via version fields throwing `ConflictProblemError` (HTTP 409).
