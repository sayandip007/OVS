# OVS Phase 8.2 – Backend Foundation Implementation Report

## 1. Executive Summary

Phase 8.2 establishes the production-grade **Backend Foundation** for the Online Voting System (OVS) while preserving 100% backward compatibility with the existing React 19 frontend (`Phases 1–7.7`) in `LOCAL_DEMO` mode.

In addition to implementing the Express 5 + TypeScript + Prisma + PostgreSQL 16 backend foundation, Phase 8.2 audited and executed the Phase 8.1.6 PostgreSQL validation workflow against a live PostgreSQL instance, identifying and fixing 3 runtime SQL/script issues so that all 31 PostgreSQL trigger and constraint scenarios pass with `ON_ERROR_STOP=1`.

---

## 2. Live PostgreSQL Verification of Phase 8.1.6 Baseline

During the mandatory audit and live PostgreSQL execution of the Phase 8.1.6 SQL artifacts, three runtime issues were discovered and resolved:

1. **Prisma `?schema=public` URI vs `psql` (libpq)**:
   - **Finding**: Prisma requires `?schema=public` on `DATABASE_URL`, whereas `psql` rejects `schema` as an unrecognized libpq connection parameter (`psql: error: invalid URI query parameter: "schema"`).
   - **Resolution**: Stripped `?schema=public` via parameter expansion (`PG_URI="${DATABASE_URL%\?*}"`) when invoking `psql` in CI and local scripts.
2. **PL/pgSQL `RAISE EXCEPTION` Format String Parameter Mismatch in `CUSTOM_DATABASE_INTEGRITY.sql` (Line 942)**:
   - **Finding**: Inside `verify_counting_session_publication()`, the statement:
     ```sql
     RAISE EXCEPTION 'Corrected result must return to RESULT_READY_FOR_REVIEW before publication.', NEW.status;
     ```
     passed `NEW.status` without a `%` placeholder in the format string, causing PostgreSQL to reject the function definition with `ERROR: too many parameters specified for RAISE`.
   - **Resolution**: Updated the format string to `'Corrected result must return to RESULT_READY_FOR_REVIEW before publication (attempted transition to %).', NEW.status;`.
3. **Top-Level `RAISE NOTICE` Statements and Non-Hex Test UUIDs in `tests/postgresql-validation.sql`**:
   - **Finding**: `tests/postgresql-validation.sql` contained 10 top-level `RAISE NOTICE '...'` statements outside `DO $$ BEGIN ... END $$;` blocks (invalid in standard SQL outside PL/pgSQL) and 3 UUID literals starting with `uuuuuuuu-...` (`u` is outside `[0-9a-f]`).
   - **Resolution**: Wrapped all 10 top-level progress notices in `DO $$ BEGIN RAISE NOTICE '...'; END $$;` blocks and replaced the 3 `uuuuuuuu-...` UUIDs with valid hex UUIDs (`00000001-1111-...`, `00000002-2222-...`, `00000003-3333-...`).
   - **Verification**: Executed `psql "$PG_URI" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql` against live PostgreSQL — **all 31 scenarios passed** with exit code `0`.

---

## 3. Backend Architecture & Stack (`backend/`)

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 22+ | ES Modules (`"type": "module"`) |
| HTTP Framework | Express | `5.1.0` | Native promise error forwarding, modular routing |
| Language | TypeScript | `5.8.2` | Strict mode (`strict: true`, `NodeNext` resolution) |
| Database & ORM | PostgreSQL 16 + Prisma | `6.4.1` | 25 models, 17 enums, explicit `@map()` / `@@map()` |
| Validation | Zod | `3.24.2` | Environment startup validation + request `params`/`query`/`body` |
| Structured Logging | Pino + `pino-http` | `9.6.0` / `10.5.0` | JSON logs with `requestId` correlation & PII redaction |
| Security Middleware | Helmet, CORS, `express-rate-limit` | `8.1.0` / `2.8.5` / `7.5.0` | Hardened headers, origin allowlist, `100kb` JSON limit, RFC 9457 rate-limit errors |
| Testing | `node:test` + Supertest | `7.0.0` | Unit tests + live PostgreSQL HTTP integration tests |

---

## 4. Prisma Schema & Reproducible Migrations (`backend/prisma/`)

- **`backend/prisma/schema.prisma`**: Promoted directly from `docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma` with all **25 models** and **17 enums**.
- **`backend/prisma/migrations/20261101000000_init_base_schema/migration.sql`**: Base PostgreSQL DDL creating all 17 enums, 25 tables, primary keys, unique indexes, and foreign keys.
- **`backend/prisma/migrations/20261101000100_custom_database_integrity/migration.sql`**: Applies all custom `CHECK` constraints, composite foreign keys, partial unique indexes, and 16 PL/pgSQL trigger functions and triggers from `CUSTOM_DATABASE_INTEGRITY.sql`.
- **`backend/prisma/seed.ts`**: Idempotent `DEMO_SAMPLE` seed script populating 3 states/UTs (`WB`, `MH`, `DL`), 6 districts, 6 Parliamentary constituencies, 8 Assembly constituencies, 5 political parties, 9 synthetic candidates, 2 elections (`LS-2029` and `WB-ASSEMBLY-2029`), 2 election phases, 10 `ElectionConstituency` mappings, and 9 `APPROVED` `CandidateNomination` records (including an independent nomination with `partyId: null`).

---

## 5. Implemented Read-Only API Endpoints (`/api/v1`)

1. `GET /api/v1/health/live` — Process liveness check (`status: "ALIVE"`).
2. `GET /api/v1/health/ready` — Readiness probe executing `SELECT 1` via Prisma (`200 OK` when PostgreSQL is reachable, `503 application/problem+json` when unavailable).
3. `GET /api/v1/geography/states` — List states/UTs with optional `status`, `isUnionTerritory`, and `search` filters.
4. `GET /api/v1/geography/states/:stateId` — Retrieve state by UUID or `stateCode` (e.g., `WB`, `MH`, `DL`).
5. `GET /api/v1/geography/states/:stateId/districts` — List districts within a state ordered by `districtNumber`.
6. `GET /api/v1/geography/states/:stateId/parliamentary-constituencies` — List Parliamentary constituencies within a state with optional `reservationCategory` and `search` filters.
7. `GET /api/v1/geography/states/:stateId/assembly-constituencies` — List Assembly constituencies within a state with parent PC and district metadata.
8. `GET /api/v1/geography/constituencies/:constituencyId` — Retrieve either a Parliamentary or Assembly constituency by UUID or `constituencyCode` (e.g., `WB-PC-23`, `WB-AC-159`).
9. `GET /api/v1/elections` — List elections with optional `type`, `status`, and `stateId` filters.
10. `GET /api/v1/elections/:electionId` — Retrieve election details and phases by UUID or `electionCode` (e.g., `LS-2029`, `WB-ASSEMBLY-2029`).
11. `GET /api/v1/elections/:electionId/constituencies` — List constituencies mapped to an election via `ElectionConstituency`.
12. `GET /api/v1/elections/:electionId/candidates` — List candidate nominations for an election with historical nomination-bound `party` (`CandidateNomination.partyId`) and `isIndependent` flag.
13. `GET /api/v1/parties` — List political parties with optional `category`, `status`, and `search` filters.
14. `GET /api/v1/parties/:partyId` — Retrieve political party by UUID, `partyCode`, or `abbreviation`.
15. `GET /api/v1/candidates/:candidateId` — Retrieve candidate profile and nomination history by UUID or `candidateCode`.

---

## 6. Strict Phase 8.2 Scope Compliance

In accordance with Phase 8.2 boundaries, no authentication, voter registration, OTP, admin CRUD, ballot submission, participation recording, counting round mutation, or result publication endpoints were added. Ballot secrecy invariants remain untouched and verified by the 31-scenario PostgreSQL validation suite.
