# OVS Phase 8.2 — API Foundation Reference (`docs/backend/API_FOUNDATION.md`)

## 1. Overview & Scope

Phase 8.2 implements the read-only versioned REST API foundation (`/api/v1`) for the Online Voting System (OVS) using **Node.js 22+**, **Express 5**, **TypeScript**, **Zod**, and **Prisma ORM 6.4.1** over **PostgreSQL 16+**.

### Strict Phase 8.2 Scope Boundary
- **Included**: Health/readiness probes, electoral geography queries, election metadata/constituency/candidate queries, political party queries, and candidate profile queries.
- **Excluded (Deferred to Phases 8.3–8.5)**: Voter registration, authentication/OTP, session login/logout, admin authentication/CRUD, nomination mutations, election mutations, demo participation mutations, ballot selection, counting mutations, and result publication endpoints.
- **Ballot Secrecy Invariant**: No endpoint accepts or returns voter ballot choices, and `DemoParticipation` has zero relation to `Candidate` or `CandidateTally`.

---

## 2. Standard Response Envelopes

### 2.1 Success Envelope (`200 OK`, `Content-Type: application/json`)

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "timestamp": "2026-11-01T12:30:00.000Z",
    "requestId": "9f8c6c91-1f45-4c0c-a59a-72186e208f8d",
    "pagination": {
      "page": 1,
      "limit": 50,
      "pageSize": 50,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

### 2.2 Error Response — RFC 9457 Problem Details (`Content-Type: application/problem+json`)

All validation failures (`400`), forbidden CORS origins (`403`), unmatched routes or missing entities (`404`), conflicts (`409`), rate limit violations (`429`), unexpected internal errors (`500`), and database readiness failures (`503`) return a standardized RFC 9457 Problem Details payload:

```json
{
  "type": "https://ovs.eci.gov.in/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Input validation failed on one or more request parameters.",
  "instance": "/api/v1/geography/states?page=0",
  "code": "VALIDATION_FAILED",
  "requestId": "9f8c6c91-1f45-4c0c-a59a-72186e208f8d",
  "invalidParams": [
    {
      "name": "page",
      "reason": "page must be at least 1"
    }
  ]
}
```

---

## 3. Endpoint Specification

### 3.1 Health & Readiness
- **`GET /api/v1/health/live`**
  - **Purpose**: Lightweight process liveness check. Does not query PostgreSQL.
  - **Response (`200 OK`)**: `{ status: "UP", service: "ovs-backend", phase: "8.2-foundation", environment, uptimeSeconds }`
- **`GET /api/v1/health/ready`**
  - **Purpose**: Executes `SELECT 1` against PostgreSQL via Prisma.
  - **Responses**:
    - `200 OK`: `{ status: "READY", service: "ovs-backend", database: { status: "UP", latencyMs } }`
    - `503 Service Unavailable`: RFC 9457 Problem Details (`code: "SERVICE_UNAVAILABLE"`).

### 3.2 Electoral Geography
- **`GET /api/v1/geography/states`**
  - **Query Params**: `page` (default `1`), `limit` (default `50`, max `200`), `type` (`STATE` | `UNION_TERRITORY`), `search`
- **`GET /api/v1/geography/states/:stateId`**
  - **Path Params**: `stateId` (case-insensitive, normalized to uppercase, e.g. `WB`, `MH`, `DL`)
  - **Responses**: `200 OK` with `_count` of districts, parliamentary seats, assembly seats, and elections; `404 Not Found` if state does not exist.
- **`GET /api/v1/geography/states/:stateId/districts`**
  - **Query Params**: `page`, `limit`, `search`
- **`GET /api/v1/geography/states/:stateId/parliamentary-constituencies`**
  - **Query Params**: `page`, `limit`, `reservationType` (`GENERAL` | `SC` | `ST`), `search`
- **`GET /api/v1/geography/states/:stateId/assembly-constituencies`**
  - **Query Params**: `page`, `limit`, `districtId`, `parentParliamentaryConstituencyId`, `reservationType`, `search`
- **`GET /api/v1/geography/constituencies/:constituencyId`**
  - **Query Params**: Optional `type` (`PARLIAMENTARY` | `ASSEMBLY`)
  - **Behavior**: Resolves a Parliamentary Constituency (including `childAssemblySeats`) or Assembly Constituency (including `parentParliamentary` and `district`).

### 3.3 Elections
- **`GET /api/v1/elections`**
  - **Query Params**: `page`, `limit`, `type` (`LOK_SABHA` | `STATE_ASSEMBLY`), `status`, `stateId`, `year`
- **`GET /api/v1/elections/:electionId`**
  - **Path Params**: `electionId` (e.g. `LS-2029`, `WB-ASSEMBLY-2029`)
  - **Response**: Full election schedule, state details, lifecycle history, and summary counts.
- **`GET /api/v1/elections/:electionId/constituencies`**
  - **Query Params**: `page`, `limit`, `constituencyType`, `stateId`, `districtId`
- **`GET /api/v1/elections/:electionId/candidates`**
  - **Query Params**: `page`, `limit`, `constituencyId`, `parliamentaryConstituencyId`, `assemblyConstituencyId`, `partyId`, `status` (defaults to `APPROVED`)
  - **Historical Party Invariant**: Returns `nominationPartyId`, `isIndependent` (`nomination.partyId === null`), and `nominationParty` from `CandidateNomination`, preserving historical nomination affiliation independently of `candidate.currentRegisteredPartyId`.

### 3.4 Political Parties & Candidates
- **`GET /api/v1/parties`**
  - **Query Params**: `page`, `limit`, `partyType` (`NATIONAL` | `STATE` | `INDEPENDENT`), `status` (`ACTIVE` | `INACTIVE` | `ARCHIVED`), `search`
- **`GET /api/v1/parties/:partyId`**
  - **Path Params**: `partyId` (e.g. `PARTY-AITC`, `PARTY-BJP`)
- **`GET /api/v1/candidates/:candidateId`**
  - **Path Params**: `candidateId` (e.g. `CAND-LS29-WB-KRN-1`)
  - **Response**: Candidate profile, `currentRegisteredPartyId`, `currentRegisteredParty`, and `nominations[]` where each nomination preserves its own historical `nominationPartyId` and `nominationParty`.

### 3.5 Voter Authentication & Session Management (Phase 8.3)
- **`POST /api/v1/auth/register`**
  - **Payload**: `fullName`, `dateOfBirth` (>= 18 yrs), `gender`, `mobile`, `email`, `epicNumber`, `address`, `pinCode`, `stateId`, `districtId`, `parliamentaryConstituencyId`, `assemblyConstituencyId`.
  - **Behavior**: Atomic creation of `User` and `VoterProfile` records in transaction. Normalizes mobile/email, validates geographic hierarchy, rejects duplicates with 409 Conflict.
- **`POST /api/v1/auth/otp/request`**
  - **Payload**: `identifier` (mobile or EPIC).
  - **Behavior**: Issues 5-minute cryptographic OTP challenge, records HMAC-SHA256 digest in `AuthChallenge`, limits rate, avoids account enumeration.
- **`POST /api/v1/auth/otp/verify`**
  - **Payload**: `challengeId` (UUID), `otp` (6 digits).
  - **Behavior**: Constant-time digest verification, max 3 attempts lockout, atomic challenge consumption preventing replay, creates server session with SHA-256 token hashing, sets HttpOnly `ovs_session` cookie.
- **`GET /api/v1/auth/me`**
  - **Response**: Authenticated user identity and safe voter profile summary. Requires active session.
- **`GET /api/v1/auth/csrf`**
  - **Response**: `{ csrfToken }` HMAC-derived token bound to active session.
- **`GET /api/v1/auth/sessions`**
  - **Response**: List of active user sessions without exposing raw session tokens.
- **`DELETE /api/v1/auth/sessions/:sessionId`**
  - **Behavior**: Revokes specific session owned by authenticated user.
- **`POST /api/v1/auth/logout`**
  - **Behavior**: Revokes current session, clears `ovs_session` cookie.
- **`POST /api/v1/auth/logout-all`**
  - **Behavior**: Revokes all sessions belonging to the current user.
- **`GET /api/v1/auth/dev/latest-otp`** (Development/Testing Only)
  - **Query Params**: `identifier`
  - **Behavior**: Returns latest generated OTP in non-production environments. Strictly disabled in production.

### 3.6 Voter Profile APIs (Phase 8.3)
- **`GET /api/v1/voters/me`**
  - **Behavior**: Returns authenticated voter's profile with fully resolved State, District, Parliamentary Constituency, and Assembly Constituency objects.
- **`PATCH /api/v1/voters/me`**
  - **Behavior**: Updates permitted demographic fields (`fullName`, `gender`, `address`, `pinCode`, `mobile`, `email`, `stateId`, `districtId`, `assemblyConstituencyId`, `parliamentaryConstituencyId`). Enforces anti-CSRF token (`X-CSRF-Token`). Validates geographic hierarchy consistency. Strictly rejects role/privilege escalation.
- **`GET /api/v1/voters/me/constituencies`**
  - **Behavior**: Returns voter's geographic and constituency relationships.
