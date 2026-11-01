# OVS Backend System Architecture (Phase 8.1.2 Hardened)

## 1. Executive Summary & Vision

The **Online Voting System (OVS)** backend is designed to provide a robust, persistent, and verifiable server-side architecture for an educational India-wide election management and voting simulation platform.

The existing frontend (Phases 1–7.7) has established a rich, battle-tested domain model covering:
- **Pan-India Electoral Geography**: 28 States and 8 Union Territories (36 jurisdictions), 543 Lok Sabha seats, 4,123 Assembly seats, represented by interactive datasets.
- **Dual-Constituency Architecture**: Distinct Parliamentary Constituencies (`PARLIAMENTARY`) and Assembly Constituencies (`ASSEMBLY`) mapped independently to voter profiles.
- **Simultaneous Elections**: Concurrent execution of nationwide Lok Sabha General Elections (`LOK_SABHA`) and State Legislative Assembly Elections (`STATE_ASSEMBLY`) with independent lifecycles.
- **ECI-Grade Administrative Management**: 5-role Role-Based Access Control (RBAC) with normalized geographic and election-scoped authorization (`admin_election_scopes`).
- **Strict Decoupling of Demo Ballot & Counting Engine**: Participation confirmations record only non-revealing tokens (`VOTED`), never storing candidate choices, while counting simulations run on independent, deterministic datasets.

The backend transition transitions this frontend from client-side `localStorage` persistence into a production-grade, relational, API-driven architecture while **strictly preserving** all domain invariants, electoral boundaries, and privacy guarantees.

---

## 2. Architecture Principles & Constraints

1. **Modular Monolith First (Anti-Microservices Premature Optimization)**:
   - Built as a single deployable Node.js / TypeScript application with strictly enforced internal module boundaries.
   - High cohesion within domains (e.g., `geography`, `elections`, `candidates`, `counting`) and loose coupling via explicit service interfaces.
   - Avoids distributed transaction overhead, network latency, and operational complexity.
2. **Relational Source of Truth (24 Models, 17 Enums, 100% Explicit Column Mappings)**:
   - PostgreSQL 16+ as the primary transactional database.
   - Foreign-key constraints, composite unique keys, partial unique indexes, check constraints, and transactional isolation (`READ COMMITTED` / `SERIALIZABLE` where appropriate).
   - Managed through Prisma ORM with explicit `@map("column_name")` declarations across all 24 models and custom SQL triggers in `CUSTOM_DATABASE_INTEGRITY.sql` enforcing Section 33(7) nomination limits, publication review gates, and mathematical counting reconciliation.
3. **Strict Ballot Secrecy & Decoupling**:
   - The backend **must never** expose an endpoint that accepts a voter identity linked to a candidate choice.
   - The voter demo participation table (`DemoParticipation`) records only `{ voterId, electionId, status: 'VOTED', referenceId, demoReference, participatedAt, recordedAt }`.
   - Counting sessions (`CountingSession`, `CountingRound`, `CandidateTally`) are completely independent entities seeded deterministically or simulated by administrative officers.
4. **Server-Authoritative RBAC & Scope Enforcement**:
   - Client-side route guards are treated as UX aids only.
   - Every API endpoint enforces role permissions and jurisdictional scope (national, state-assigned, or election-assigned via `admin_election_scopes`) at the middleware and service layers.
5. **Session Security & CSRF Defense**:
   - Purely HttpOnly, Secure, SameSite=Strict session cookies (`ovs_session`). No Bearer tokens stored in client LocalStorage.
   - Double-submit CSRF token header (`X-CSRF-Token`) and Origin/Referer verification for all mutating requests.
6. **Standardized RFC 9457 Errors**:
   - All errors formatted as `application/problem+json` Problem Details objects.

---

## 3. High-Level System Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER (React 19 SPA)                                    │
│  Public Portal  │  Voter Portal  │  ECI Administration Portal  │  Results Hub & Live Analytics   │
└───────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                    │ HTTPS / JSON REST API (ovs_session Cookie)
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                BACKEND LAYER (Node.js 22 + Express)                              │
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                     GATEWAY & MIDDLEWARE                                   │  │
│  │   Helmet Security Headers │ CORS Policy │ Rate Limiter (express-rate-limit)                │  │
│  │   Pino Structured Logger  │ Cookie-Parser (HttpOnly Sessions) │ CSRF Guard (X-CSRF-Token)  │  │
│  │   Auth Middleware (Session Verification) │ RBAC & Scope Guard (Role & Scope Check)         │  │
│  │   Zod Request Validation Filter (RFC 9457 Problem Details Formatter)                       │  │
│  └────────────────────────────────────────────┬───────────────────────────────────────────────┘  │
│                                               │                                                  │
│  ┌────────────────────────────────────────────▼───────────────────────────────────────────────┐  │
│  │                                  MODULAR DOMAIN SERVICES                                   │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │   Geography Module      │  │    Elections Module     │  │     Candidates Module      │  │  │
│  │  │ States, Districts,      │  │ Lifecycles, Schedules,  │  │ Parties, Nominations,      │  │  │
│  │  │ PCs, ACs, Delimitation  │  │ Timeline Validator      │  │ Scrutiny & Approval        │  │  │
│  │  └─────────────────────────┘  └─────────────────────────┘  └────────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │  Voters & Auth Module   │  │ Demo Participation Mod  │  │ Counting & Results Module  │  │  │
│  │  │ Profiles, Dual Mapping, │  │ Non-revealing tokens,   │  │ 10-state machine, Rounds,  │  │  │
│  │  │ Sessions, Rate Limiting │  │ Strict Ballot Decoupling│  │ Publications, CSV Exports  │  │  │
│  │  └─────────────────────────┘  └─────────────────────────┘  └────────────────────────────┘  │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │   Admin & RBAC Module   │  │   Audit Logging Module  │  │    Notification Module     │  │  │
│  │  │ 5 ECI Roles, Scopes,    │  │ Append-only sanitized   │  │ Voter announcements,       │  │  │
│  │  │ admin_election_scopes   │  │ officer action trail    │  │ Typed constituency targets │  │  │
│  │  └─────────────────────────┘  └─────────────────────────┘  └────────────────────────────┘  │  │
│  └────────────────────────────────────────────┬───────────────────────────────────────────────┘  │
│                                               │                                                  │
│  ┌────────────────────────────────────────────▼───────────────────────────────────────────────┐  │
│  │                                DATA ACCESS LAYER (Prisma ORM)                              │  │
│  │   Prisma Client │ Relational Repositories │ Transaction Manager │ Query Optimizers         │  │
│  └────────────────────────────────────────────┬───────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┼──────────────────────────────────────────────┘
                                                    │ PostgreSQL Wire Protocol
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PERSISTENCE LAYER                                          │
│  PostgreSQL 16 Relational Database (Composite Keys, Partial Unique Indexes, CHECK Constraints)   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Layer Separation & Responsibilities

### 4.1 Transport & Route Layer (`modules/*/routes.ts`)
- Maps HTTP verbs and URI patterns (`/api/v1/...`).
- Attaches rate-limiting, authentication, RBAC authorization, and validation middleware.
- Does not contain business logic. Delegates immediately to controllers.

### 4.2 Controller Layer (`modules/*/controller.ts`)
- Parses request body, query parameters, route parameters, and session context.
- Invokes domain services and receives typed domain models or failure results.
- Translates service outcomes into standardized RFC 9457 Problem Details or JSON envelopes.

### 4.3 Service / Domain Logic Layer (`modules/*/service.ts`)
- Implements pure electoral domain rules:
  - 8-point election timeline validation (`nominationStartDate <= nominationEndDate <= scrutinyDate <= ... <= pollingEndDate <= countingDate <= resultDate`).
  - Pre-polling start guards and counting completion publication guards.
  - Candidate-to-constituency type matching (`LOK_SABHA` -> `PARLIAMENTARY`, `STATE_ASSEMBLY` -> `ASSEMBLY`).
  - Single participation enforcement per voter per election.
  - Zero candidate-choice persistence.
  - Deterministic round-by-round counting simulations and standings calculation.
  - 10-status result lifecycle state machine (`DRAFT` through `PUBLISHED`, `TIED`, etc.).
- Completely isolated from HTTP primitives (`req`, `res`). Can be unit tested in isolation.

### 4.4 Data Access / Repository Layer (`modules/*/repository.ts` / Prisma)
- Wraps Prisma queries.
- Manages multi-entity database transactions (`prisma.$transaction`).
- Enforces relational referential integrity, composite foreign keys, unique constraints, and soft-delete filters where applicable.

---

## 5. Backend Directory Structure

```text
backend/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── 001_initial_schema/
│       └── 002_custom_integrity_constraints/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── constants.ts
│   │   └── logger.ts
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── requestLogger.ts
│   │   ├── rateLimiter.ts
│   │   ├── authenticate.ts
│   │   ├── authorize.ts
│   │   ├── csrf.ts
│   │   └── validateRequest.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── voters/
│   │   ├── geography/
│   │   ├── elections/
│   │   ├── candidates/
│   │   ├── participation/
│   │   ├── counting/
│   │   ├── administration/
│   │   ├── announcements/
│   │   └── audit/
│   ├── database/
│   │   └── prisma.ts
│   └── utils/
│       ├── errors.ts
│       ├── hashing.ts
│       └── formatting.ts
└── tests/
    ├── unit/
    ├── integration/
    └── setup.ts
```

---

## 6. Asynchronous Jobs & Scalability Roadmap

1. **Current Scope (Phase 8.1 / 8.2)**:
   - Synchronous processing within Express request/response loop for all standard CRUD operations, round advancements, and audit logging.
   - Long-running exports (e.g. state-wide CSV result exports) are streamed directly using Node.js stream pipelines.
2. **Future Production Enhancements (Phase 9+)**:
   - **Job Queue**: BullMQ backed by Redis for scheduled electoral roll cutoffs, automated counting round processing, and bulk voter notifications.
   - **Read-Replica Routing**: Direct high-volume public result queries to read-replicas during peak election counting days.
   - **Caching Layer**: Redis caching for static electoral geography and declared historical results (`LS-2024`).
