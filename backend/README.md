# OVS Backend Foundation (Phase 8.2)

Production-grade **Modular Monolith** backend foundation for the **Online Voting System (OVS)** educational election-management and voting simulation platform.

## 1. Technology Stack

- **Runtime**: Node.js 22+ (ES Modules)
- **Framework**: Express 5 (`5.1.0`)
- **Language**: TypeScript (`5.8.2`, strict mode)
- **Database**: PostgreSQL 16+
- **ORM & Migrations**: Prisma ORM (`6.4.1`) with explicit snake_case `@map()` / `@@map()` physical mappings and custom PL/pgSQL integrity triggers
- **Validation**: Zod (`3.24.2`) for startup environment variables and HTTP request parameters
- **Observability**: Pino (`9.6.0`) + `pino-http` (`10.5.0`) structured JSON logging with correlation `X-Request-Id` and strict PII redaction
- **Security**: Helmet (`8.1.0`), strict CORS allowlist (`cors` `2.8.5` with `credentials: true`), and `express-rate-limit` (`7.5.0`)
- **Error Contract**: RFC 9457 Problem Details (`application/problem+json`)
- **Testing**: Node.js built-in test runner (`node:test`) + Supertest (`7.0.0`) against live PostgreSQL

---

## 2. Directory Structure

```text
backend/
├── Dockerfile
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── migration_lock.toml
│       ├── 20261101000000_init_base_schema/
│       │   └── migration.sql
│       └── 20261101000100_custom_database_integrity/
│           └── migration.sql
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   └── database.ts
│   ├── common/
│   │   ├── errors/
│   │   │   └── problemDetails.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   ├── logger.ts
│   │   │   ├── requestId.ts
│   │   │   ├── security.ts
│   │   │   └── validate.ts
│   │   └── utils/
│   │       └── response.ts
│   └── modules/
│       ├── health/
│       │   └── health.routes.ts
│       ├── geography/
│       │   ├── geography.schemas.ts
│       │   ├── geography.repository.ts
│       │   ├── geography.service.ts
│       │   └── geography.routes.ts
│       ├── elections/
│       │   ├── elections.schemas.ts
│       │   ├── elections.repository.ts
│       │   ├── elections.service.ts
│       │   └── elections.routes.ts
│       ├── parties/
│       │   ├── parties.schemas.ts
│       │   ├── parties.repository.ts
│       │   ├── parties.service.ts
│       │   └── parties.routes.ts
│       └── candidates/
│           └── candidates.routes.ts
└── tests/
    ├── unit/
    │   └── foundation.unit.test.ts
    └── integration/
        └── api.integration.test.ts
```

---

## 3. Quick Start

```bash
# 1. Install dependencies & generate Prisma Client
npm --prefix backend install
npm --prefix backend run prisma:generate

# 2. Apply Prisma migrations (base DDL + custom SQL triggers/constraints)
npm --prefix backend run prisma:migrate:deploy

# 3. Seed synthetic DEMO_SAMPLE dataset (idempotent)
npm --prefix backend run prisma:seed

# 4. Run unit and live PostgreSQL integration tests
npm --prefix backend test

# 5. Start backend server in development mode (Port 5000)
npm --prefix backend run dev
```

---

## 4. Phase 8.2 Read-Only API Endpoints (`/api/v1`)

| Domain | Method & Path | Description |
| :--- | :--- | :--- |
| **Health** | `GET /api/v1/health/live` | Process liveness probe (`200 OK`) |
| **Health** | `GET /api/v1/health/ready` | PostgreSQL readiness probe (`200 OK` / `503 Service Unavailable`) |
| **Geography** | `GET /api/v1/geography/states` | List States and Union Territories |
| **Geography** | `GET /api/v1/geography/states/:stateId` | Get State/UT details |
| **Geography** | `GET /api/v1/geography/states/:stateId/districts` | List districts for a State/UT |
| **Geography** | `GET /api/v1/geography/states/:stateId/parliamentary-constituencies` | List Parliamentary Constituencies (PCs) for a State/UT |
| **Geography** | `GET /api/v1/geography/states/:stateId/assembly-constituencies` | List Assembly Constituencies (ACs) for a State/UT |
| **Geography** | `GET /api/v1/geography/constituencies/:constituencyId` | Resolve PC or AC by ID with full hierarchy |
| **Elections** | `GET /api/v1/elections` | List elections (`LOK_SABHA`, `STATE_ASSEMBLY`) |
| **Elections** | `GET /api/v1/elections/:electionId` | Get election details and lifecycle history |
| **Elections** | `GET /api/v1/elections/:electionId/constituencies` | List constituencies mapped to an election |
| **Elections** | `GET /api/v1/elections/:electionId/candidates` | List approved candidate nominations with historical nomination-bound party affiliation |
| **Parties** | `GET /api/v1/parties` | List political parties |
| **Parties** | `GET /api/v1/parties/:partyId` | Get political party details and registered candidates |
| **Candidates** | `GET /api/v1/candidates/:candidateId` | Get candidate profile with historical nomination-bound party affiliations |
