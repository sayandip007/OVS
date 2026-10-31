# OVS REST API Specification (v1)

## 1. Global API Standards & Conventions

- **Base URI**: `/api/v1`
- **Transport**: HTTPS with TLS 1.3 (HTTP/2 supported).
- **Format**: JSON (`Content-Type: application/json; charset=utf-8`).
- **Session Identification**: Secure HttpOnly cookie (`ovs_session`) or Bearer token header (`Authorization: Bearer <session_token>`).
- **Standard Success Envelope**:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": {
      "timestamp": "2029-04-20T10:30:00.000Z",
      "pagination": { "page": 1, "pageSize": 20, "total": 100 }
    }
  }
  ```
- **Standard RFC-7807 Error Response**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Input validation error.",
      "details": {
        "mobile": ["Mobile must be a valid 10-digit Indian number."]
      }
    }
  }
  ```
- **CRITICAL BALLOT PRIVACY INVARIANT**: No endpoint accepts or returns candidate selection alongside identified voter records.

---

## 2. Authentication Endpoints (`/api/v1/auth`)

### 2.1 Register New Voter
- **Method & Path**: `POST /api/v1/auth/register`
- **Purpose**: Registers a new citizen voter with dual-constituency assignment.
- **Auth / Role**: Public (Unauthenticated).
- **Request Body**:
  ```json
  {
    "fullName": "Sourav Gangopadhyay",
    "dob": "1995-08-19",
    "gender": "Male",
    "email": "sourav.g@example.in",
    "mobile": "9830998877",
    "voterRef": "WBX7766554",
    "address": "12 Rabindra Sarani, Krishnanagar, Nadia",
    "pinCode": "741101",
    "stateId": "WB",
    "districtId": "DIST-WB-NADIA",
    "parliamentaryConstituencyId": "PC-WB-KRISHNANAGAR",
    "assemblyConstituencyId": "AC-WB-KRISHNANAGAR-UTTAR",
    "password": "SecurePassword123!"
  }
  ```
- **Validation Rules (Zod)**: Age >= 18; valid Indian 10-digit mobile; unique `voterRef`; valid `stateId`, `districtId`, `parliamentaryConstituencyId`, and `assemblyConstituencyId` hierarchy.
- **Responses**:
  - `201 Created`: `{ "success": true, "data": { "voterId": "uuid", "epicNumber": "WBX7766554" } }`
  - `400 Bad Request`: Validation failure.
  - `409 Conflict`: EPIC or email already registered.

### 2.2 Voter Login (Initiate Challenge)
- **Method & Path**: `POST /api/v1/auth/login`
- **Purpose**: Validates voter identifier (EPIC) and mobile, issuing an OTP challenge.
- **Auth / Role**: Public.
- **Request Body**:
  ```json
  {
    "identifier": "WBX1234567",
    "mobile": "9830011223"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "challengeId": "uuid",
        "maskedMobile": "XXXXXX1223",
        "expiresInSeconds": 120,
        "demoOtpNotice": "In demonstration mode, default OTP is 123456"
      }
    }
    ```
  - `401 Unauthorized`: Invalid credentials.

### 2.3 Verify OTP Challenge (Complete Authentication)
- **Method & Path**: `POST /api/v1/auth/otp/verify`
- **Purpose**: Verifies the OTP, creates a session, and sets an HttpOnly session cookie.
- **Auth / Role**: Public.
- **Request Body**:
  ```json
  {
    "challengeId": "uuid",
    "otp": "123456"
  }
  ```
- **Responses**:
  - `200 OK`: Sets cookie `ovs_session`; returns voter summary.
  - `401 Unauthorized`: Invalid OTP / Exceeded maximum 3 attempts.

### 2.4 Resend OTP
- **Method & Path**: `POST /api/v1/auth/otp/resend`
- **Purpose**: Generates a secondary simulated OTP with cooldown enforcement.
- **Auth / Role**: Public.
- **Request Body**: `{ "challengeId": "uuid" }`
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "cooldownSeconds": 30 } }`
  - `429 Too Many Requests`: Cooldown active.

### 2.5 User Logout
- **Method & Path**: `POST /api/v1/auth/logout`
- **Purpose**: Revokes current session and clears session cookie.
- **Auth / Role**: Authenticated (`VOTER` or `ADMIN`).
- **Responses**:
  - `200 OK`: `{ "success": true, "message": "Logged out successfully." }`

### 2.6 Get Current Session Profile
- **Method & Path**: `GET /api/v1/auth/me`
- **Purpose**: Returns current user profile, role, and permission scopes.
- **Auth / Role**: Authenticated.
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "userType": "VOTER", "profile": { ... } } }`
  - `401 Unauthorized`: Unauthenticated.

---

## 3. Voter Profile & Elections Endpoints (`/api/v1/voters`)

### 3.1 Get Voter Profile
- **Method & Path**: `GET /api/v1/voters/me`
- **Purpose**: Retrieves authenticated voter's personal details, dual-constituency assignment, and completion percentage.
- **Auth / Role**: Authenticated (`VOTER`).
- **Responses**:
  - `200 OK`: Returns full `VoterProfile` with state, district, PC, and AC records.

### 3.2 Update Voter Personal Information
- **Method & Path**: `PATCH /api/v1/voters/me`
- **Purpose**: Updates non-electoral personal details (email, mobile, address).
- **Auth / Role**: Authenticated (`VOTER`).
- **Request Body**: `{ "email": "new.email@example.in", "mobile": "9830099999", "address": "..." }`
- **Validation**: Constituencies are locked; cannot be modified by voters.
- **Responses**:
  - `200 OK`: Updated profile.

### 3.3 Get Voter Eligible Elections
- **Method & Path**: `GET /api/v1/voters/me/elections`
- **Purpose**: Computes voter's eligible elections (Lok Sabha and State Assembly) based on voter's state and constituencies.
- **Auth / Role**: Authenticated (`VOTER`).
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "eligibleElections": [
          {
            "id": "LS-2029",
            "name": "Lok Sabha General Election 2029",
            "type": "LOK_SABHA",
            "status": "POLLING_ACTIVE",
            "participationStatus": "PENDING",
            "assignedConstituency": { "id": "PC-WB-KOLKATA-SOUTH", "type": "PARLIAMENTARY", "name": "Kolkata South" }
          },
          {
            "id": "WB-ASSEMBLY-2029",
            "name": "West Bengal Legislative Assembly Election 2029",
            "type": "STATE_ASSEMBLY",
            "status": "POLLING_ACTIVE",
            "participationStatus": "PENDING",
            "assignedConstituency": { "id": "AC-WB-BHABANIPUR", "type": "ASSEMBLY", "name": "Bhabanipur" }
          }
        ],
        "participationSummary": {
          "totalCount": 2,
          "completedCount": 0,
          "label": "0 / 2 Completed",
          "percentage": 0
        }
      }
    }
    ```

### 3.4 Get Voter Participation History
- **Method & Path**: `GET /api/v1/voters/me/participation`
- **Purpose**: Returns non-sensitive demo participation receipts.
- **Auth / Role**: Authenticated (`VOTER`).
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "electionId": "LS-2029",
          "status": "VOTED",
          "demoReference": "DEMO-LS-000001",
          "referenceId": "DEMO-REF-LS2029-VOTER001",
          "participatedAt": "2029-04-20T10:30:00.000Z"
        }
      ]
    }
    ```

---

## 4. Geography Endpoints (`/api/v1/geography`)

### 4.1 List All States and Union Territories
- **Method & Path**: `GET /api/v1/geography/states`
- **Purpose**: Retrieves all 36 Indian jurisdictions with sanctioned Lok Sabha and Assembly seat tallies.
- **Auth / Role**: Public.
- **Query Parameters**: `type` (`STATE` | `UNION_TERRITORY`), `search`.
- **Responses**: `200 OK`.

### 4.2 List Districts for a State
- **Method & Path**: `GET /api/v1/geography/states/:stateId/districts`
- **Purpose**: Retrieves representative districts in a jurisdiction.
- **Auth / Role**: Public.
- **Responses**: `200 OK`.

### 4.3 List Parliamentary Constituencies (PCs)
- **Method & Path**: `GET /api/v1/geography/parliamentary-constituencies`
- **Purpose**: Retrieves Lok Sabha seats, filterable by `stateId`.
- **Auth / Role**: Public.
- **Responses**: `200 OK`.

### 4.4 List Assembly Constituencies (ACs)
- **Method & Path**: `GET /api/v1/geography/assembly-constituencies`
- **Purpose**: Retrieves Assembly seats, filterable by `stateId`, `districtId`, and `parentParliamentaryConstituencyId`.
- **Auth / Role**: Public.
- **Responses**: `200 OK`.

---

## 5. Elections, Parties & Candidates (`/api/v1/...`)

### 5.1 List Elections
- **Method & Path**: `GET /api/v1/elections`
- **Purpose**: Retrieves active, upcoming, and past elections.
- **Auth / Role**: Public.
- **Query Parameters**: `status`, `type`, `year`, `stateId`.
- **Responses**: `200 OK`.

### 5.2 Get Election Detail & Schedule
- **Method & Path**: `GET /api/v1/elections/:electionId`
- **Purpose**: Retrieves full election record with chronological milestones.
- **Auth / Role**: Public.
- **Responses**: `200 OK`.

### 5.3 List Political Parties
- **Method & Path**: `GET /api/v1/parties`
- **Purpose**: Retrieves registered parties and independent designations.
- **Auth / Role**: Public.
- **Responses**: `200 OK`.

### 5.4 List Contesting Candidates for an Election and Constituency
- **Method & Path**: `GET /api/v1/elections/:electionId/candidates`
- **Purpose**: Returns approved contesting candidates matching the election and constituency filter.
- **Auth / Role**: Public.
- **Query Parameters**: `constituencyId` (required), `status` (defaults to `'APPROVED'`), `search`, `partyId`, `sortBy` (`name` | `party`).
- **Responses**: `200 OK` (includes NOTA option metadata).

---

## 6. Demo Participation Endpoint (`/api/v1/demo-participation`)

### 6.1 Record Simulated Voter Participation
- **Method & Path**: `POST /api/v1/demo-participation`
- **Purpose**: Records that the authenticated voter participated in an eligible active election.
- **Auth / Role**: Authenticated (`VOTER`).
- **Request Body**:
  ```json
  {
    "electionId": "LS-2029"
  }
  ```
  *(Note: Request body contains NO candidateId, partyId, or ballot choice parameter! Any submitted candidate field is rejected with 400 Bad Request).*
- **Validation**:
  1. Voter must be authenticated.
  2. Election must exist and be in `POLLING_ACTIVE` status.
  3. Voter must be registered in an eligible constituency for this election.
  4. Duplicate check: Voter must not have already participated in this election (`status !== 'VOTED'`).
- **Responses**:
  - `201 Created`:
    ```json
    {
      "success": true,
      "data": {
        "status": "VOTED",
        "participated": true,
        "demoReference": "DEMO-LS-000001",
        "referenceId": "DEMO-REF-LS2029-VOTER001",
        "participatedAt": "2029-04-20T10:30:00.000Z",
        "ballotCountingSeparation": "STRICT_DECOUPLED"
      }
    }
    ```
  - `400 Bad Request`: Election not active, state mismatch, or prohibited candidate choice field supplied.
  - `409 Conflict`: Duplicate participation attempt (`ALREADY_PARTICIPATED`).

---

## 7. Counting & Results Endpoints (`/api/v1/admin/counting-sessions` & `/api/v1/results`)

### 7.1 Advance Counting Round (ECI Officer Action)
- **Method & Path**: `POST /api/v1/admin/counting-sessions/:sessionId/rounds`
- **Purpose**: Advances the constituency counting simulation by one round.
- **Auth / Role**: Authenticated ECI Admin (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`).
- **Scope Restriction**: `STATE_ADMIN` restricted to their state; `ELECTION_OFFICER` restricted to assigned elections.
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "sessionId": "RESULT-LS-2029-WB-PC-KOLKATA-SOUTH",
        "currentRound": 3,
        "totalConfiguredRounds": 5,
        "roundVotes": 125000,
        "cumulativeVotes": 375000,
        "leadingCandidate": { "id": "CAND-LS29-KRN-1", "leadMargin": 21500 },
        "status": "COUNTING_IN_PROGRESS"
      }
    }
    ```

### 7.2 Complete Counting Session
- **Method & Path**: `POST /api/v1/admin/counting-sessions/:sessionId/complete`
- **Purpose**: Concludes rounds, checks for ties, and sets status to `RESULT_READY_FOR_REVIEW`.
- **Auth / Role**: Authorized ECI Admin.
- **Validation**: All configured rounds must be processed (`rounds.length >= totalConfiguredRounds`).
- **Responses**: `200 OK`.

### 7.3 Publish Constituency Result
- **Method & Path**: `POST /api/v1/admin/results/:sessionId/publish`
- **Purpose**: Publishes verified result, making it publicly visible on `/results`.
- **Auth / Role**: Authorized ECI Admin (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`).
- **Validation**: Guard enforces `countingStatus === 'COMPLETED'`, `rounds.length >= totalConfiguredRounds`, and no unresolved tie.
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "isPublished": true, "status": "PUBLISHED" } }`
  - `400 Bad Request`: Incomplete counting session cannot be published.

### 7.4 Public Results Listing
- **Method & Path**: `GET /api/v1/results`
- **Purpose**: Retrieves published constituency results for public dashboards.
- **Auth / Role**: Public.
- **Filter**: Implicitly filters `isPublished = true` (unpublished/draft results hidden).
- **Responses**: `200 OK`.

### 7.5 National & State Result Analytics
- **Method & Path**: `GET /api/v1/results/analytics/lok-sabha`
- **Method & Path**: `GET /api/v1/results/analytics/assembly/:stateId`
- **Purpose**: Aggregates party-wise seats won, leading seats, vote share percentages, and turnout metrics.
- **Auth / Role**: Public.
- **Responses**: `200 OK`.

### 7.6 Export Constituency Result CSV
- **Method & Path**: `GET /api/v1/results/:sessionId/export/csv`
- **Purpose**: Downloads RFC-4180 compliant CSV report with formula injection escaping.
- **Auth / Role**: Public (if published) or Admin.
- **Responses**: `200 OK` (`Content-Type: text/csv`).

---

## 8. Administration Endpoints (`/api/v1/admin/...`)

### 8.1 ECI Officer Login
- **Method & Path**: `POST /api/v1/admin/auth/login`
- **Purpose**: Authenticates administrative officer with Officer Code and Passcode.
- **Request Body**: `{ "officerCode": "ECI-SUPER-001", "passcode": "admin123" }`
- **Responses**: `200 OK` (issues 2FA OTP challenge).

### 8.2 Create or Update Election Record
- **Method & Path**: `POST /api/v1/admin/elections`
- **Method & Path**: `PATCH /api/v1/admin/elections/:electionId`
- **Purpose**: Creates/modifies election parameters and schedule milestones.
- **Auth / Role**: `SUPER_ADMIN`, `NATIONAL_ADMIN`, or scoped `STATE_ADMIN`.
- **Validation**: Enforces 8-point chronological order and type rules.
- **Responses**: `201 Created` / `200 OK`.

### 8.3 Candidate Scrutiny & Approval
- **Method & Path**: `PATCH /api/v1/admin/candidates/:candidateId/nominations/:nominationId/approval`
- **Purpose**: Approves, rejects, or suspends a candidate nomination.
- **Auth / Role**: Authorized Admin.
- **Request Body**: `{ "decision": "APPROVED", "scrutinyNote": "Verified documents." }`
- **Responses**: `200 OK`.

### 8.4 Audit Logs
- **Method & Path**: `GET /api/v1/admin/audit-logs`
- **Purpose**: Queries sanitized append-only administrative audit records.
- **Auth / Role**: Any ECI Admin (including `READ_ONLY_AUDITOR`).
- **Query Parameters**: `domain`, `actionType`, `startDate`, `endDate`, `page`, `pageSize`.
- **Responses**: `200 OK`.

### 8.5 17-Rule Data Integrity Audit
- **Method & Path**: `GET /api/v1/admin/integrity-audit`
- **Purpose**: Executes all 17 relational, geographic, and privacy integrity checks across PostgreSQL datasets.
- **Auth / Role**: Any ECI Admin.
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "isHealthy": true, "rulesPassed": 17, "totalRules": 17, "ruleResults": [...] } }`
