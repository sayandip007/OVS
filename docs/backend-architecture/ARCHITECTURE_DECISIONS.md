# OVS Architecture Decision Records (ADRs)

## Index of Architectural Decisions

- [ADR-001: Modular Monolith vs. Microservices](#adr-001-modular-monolith-vs-microservices)
- [ADR-002: PostgreSQL 16 & Prisma ORM Selection](#adr-002-postgresql-16--prisma-orm-selection)
- [ADR-003: Strict Decoupling of Voter Participation and Counting Simulation](#adr-003-strict-decoupling-of-voter-participation-and-counting-simulation)
- [ADR-004: Dual-Constituency (Parliamentary & Assembly) Relational Schema](#adr-004-dual-constituency-parliamentary--assembly-relational-schema)
- [ADR-005: Server-Authoritative 5-Role RBAC with Jurisdictional Scope Checks](#adr-005-server-authoritative-5-role-rbac-with-jurisdictional-scope-checks)
- [ADR-006: Centralized Simulation Clock & Chronological State Machine](#adr-006-centralized-simulation-clock--chronological-state-machine)
- [ADR-007: Adapter-Based Incremental Frontend Migration with Dual-Mode Support](#adr-007-adapter-based-incremental-frontend-migration-with-dual-mode-support)
- [ADR-008: HttpOnly Secure Cookie Sessions vs. Stateless JWT](#adr-008-httponly-secure-cookie-sessions-vs-stateless-jwt)
- [ADR-009: Zod Schema Validation & RFC-7807 Error Contracts](#adr-009-zod-schema-validation--rfc-7807-error-contracts)
- [ADR-010: Provenance Tracking (VERIFIED_OFFICIAL vs. DEMO_SAMPLE)](#adr-010-provenance-tracking-verified_official-vs-demo_sample)

---

### ADR-001: Modular Monolith vs. Microservices
- **Status**: Accepted
- **Context**: The OVS platform manages complex relationships between geography, elections, candidates, and counting. Distributing this across independent microservices would introduce distributed transaction overhead, network latency, and eventual consistency failures.
- **Decision**: Adopt a modular monolith in Node.js 22 with Express and TypeScript. Domain modules (`geography`, `elections`, `candidates`, `counting`) maintain clear folder boundaries and communicate through typed in-process services.
- **Consequences**: Fast development velocity, single deployable artifact, direct transactional integrity via PostgreSQL, with a straightforward refactoring path to microservices if future load warrants.

---

### ADR-002: PostgreSQL 16 & Prisma ORM Selection
- **Status**: Accepted
- **Context**: Electoral systems demand strict relational referential integrity, unique constraints across composite keys (e.g. `(stateId, constituencyNumber)`), and ACID transactions for result publishing and counting rounds.
- **Decision**: Use PostgreSQL 16 as the relational store, managed via Prisma ORM for type-safe database queries and automated migration history.
- **Consequences**: Compile-time type checking of database queries, zero SQL injection risk through automatic parameterization, and reliable schema migrations.

---

### ADR-003: Strict Decoupling of Voter Participation and Counting Simulation
- **Status**: Accepted
- **Context**: Secret ballots are a non-negotiable constitutional principle. Even in an educational prototype, storing a candidate selection against an identified voter record is a fatal architectural defect.
- **Decision**: The `demo_participations` table contains **only** `{ voterId, electionId, status: 'VOTED', demoReference, referenceId, participatedAt, recordedAt }`. There is **no candidate or party column**. Candidate tallies exist in `candidate_tallies`, populated purely from deterministic simulation seeds or administrative round simulations.
- **Consequences**: Complete ballot secrecy by structural design. An attacker with full database read access cannot deduce how a voter voted.

---

### ADR-004: Dual-Constituency (Parliamentary & Assembly) Relational Schema
- **Status**: Accepted
- **Context**: Indian voters belong simultaneously to one Parliamentary Constituency (Lok Sabha) and one Assembly Constituency (Vidhan Sabha).
- **Decision**: Model `VoterProfile` with two foreign keys: `parliamentaryConstituencyId` and `assemblyConstituencyId`. Furthermore, model `AssemblyConstituency` with `parentParliamentaryConstituencyId` reflecting official delimitation.
- **Consequences**: Enables accurate, simultaneous eligibility matching for nationwide general elections and state elections with independent participation tracking.

---

### ADR-005: Server-Authoritative 5-Role RBAC with Jurisdictional Scope Checks
- **Status**: Accepted
- **Context**: The existing frontend models 5 ECI roles (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`, `READ_ONLY_AUDITOR`). Client-side route guards alone are insufficient for backend security.
- **Decision**: Enforce role permissions and scope constraints in Express middleware (`requireAdminScope`). `STATE_ADMIN` requests must match `assignedStateId`; `ELECTION_OFFICER` requests must match `assignedElectionIds`.
- **Consequences**: Prevents horizontal privilege escalation and cross-state administrative tampering.

---

### ADR-006: Centralized Simulation Clock & Chronological State Machine
- **Status**: Accepted
- **Context**: The demonstration requires evaluating concurrent past (`LS-2024`), active polling (`LS-2029`, `WB-ASSEMBLY-2029`), and upcoming (`MH-ASSEMBLY-2029`) elections without relying on the host machine's wall clock.
- **Decision**: Standardize on a centralized reference clock (`2029-04-20`) in `DEMO_CLOCK_CONFIG`. Election status transitions enforce strict chronology: `nominationStartDate <= ... <= pollingStartDate <= pollingEndDate <= countingDate <= resultDate`. Pre-polling transitions are blocked before `pollingStartDate`.
- **Consequences**: Predictable, reproducible test suites and realistic simulation of electoral windows.

---

### ADR-007: Adapter-Based Incremental Frontend Migration with Dual-Mode Support
- **Status**: Accepted
- **Context**: The React frontend must not break during backend implementation. Developers must be able to test features offline or against the live API.
- **Decision**: Implement an adapter pattern in frontend service modules (`electionService.js`, `storageService.js`) governed by `VITE_DATA_SOURCE_MODE` (`LOCAL_DEMO` vs `BACKEND_API`).
- **Consequences**: Full backward compatibility with existing tests; zero disruption to user evaluation during migration.

---

### ADR-008: HttpOnly Secure Cookie Sessions vs. Stateless JWT
- **Status**: Accepted
- **Context**: Storing JWT tokens in browser `localStorage` exposes them to XSS exfiltration. Revoking compromised JWTs requires complex blocklist infrastructure.
- **Decision**: Use server-managed sessions stored in PostgreSQL / Redis and delivered via signed, `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- **Consequences**: Immunity to JavaScript token theft, instantaneous server-side session revocation upon logout, and native CSRF defense.

---

### ADR-009: Zod Schema Validation & RFC-7807 Error Contracts
- **Status**: Accepted
- **Context**: Inconsistent error formatting and loose input validation cause frontend rendering bugs.
- **Decision**: Define runtime Zod validation schemas for every API endpoint. Errors are formatted using the RFC-7807 Problem Details specification.
- **Consequences**: Fail-fast validation before reaching domain services, type-safe request parsing, and standardized error responses for the frontend.

---

### ADR-010: Provenance Tracking (VERIFIED_OFFICIAL vs. DEMO_SAMPLE)
- **Status**: Accepted
- **Context**: Users and auditors must clearly know which data represents verified ECI boundary definitions and which data is fictitious demonstration data.
- **Decision**: Add `metadataSource` enum (`VERIFIED_OFFICIAL` | `DEMO_SAMPLE`) to all geography, party, candidate, and election tables.
- **Consequences**: Transparent legal labeling; enables future automated ingestion of official delimitation data without corrupting demo records.
