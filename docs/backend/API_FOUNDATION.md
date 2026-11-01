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
