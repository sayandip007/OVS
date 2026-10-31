# OVS REST API Specification (v1 - Phase 8.1.1 Corrected)

## 1. Global API Standards & Conventions

- **Base URI**: `/api/v1`
- **Transport**: HTTPS with TLS 1.3 (HTTP/2 supported).
- **Format**: JSON (`Content-Type: application/json; charset=utf-8`).
- **Session Identification & Cookie Discipline**: 
  - Standardized **exclusively** on a secure, HttpOnly, SameSite=Strict cookie (`ovs_session`).
  - No Bearer tokens or client-side storage of authentication tokens in LocalStorage/SessionStorage.
- **CSRF Defense-in-Depth**:
  - `SameSite=Strict` attribute on `ovs_session` cookie.
  - Custom anti-CSRF request header requirement (`X-CSRF-Token`) for all mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Strict server-side validation of incoming `Origin` and `Referer` headers against allowed domain white-lists.
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
- **Standard RFC 9457 Problem Details Error Response** (`Content-Type: application/problem+json`):
  ```json
  {
    "type": "https://ovs.eci.gov.in/errors/validation-failed",
    "title": "Validation Failed",
    "status": 400,
    "detail": "Input validation failed on one or more submitted fields.",
    "instance": "/api/v1/auth/register",
    "invalidParams": [
      {
        "name": "mobile",
        "reason": "Mobile must be a valid 10-digit Indian number."
      }
    ]
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
- **Validation Rules (Zod)**: Age >= 18; valid Indian 10-digit mobile; unique `voterRef`; valid `stateId`, `districtId`, `parliamentaryConstituencyId`, and `assemblyConstituencyId` composite hierarchy.
- **Responses**:
  - `201 Created`: `{ "success": true, "data": { "voterId": "uuid", "epicNumber": "WBX7766554" } }`
  - `400 Bad Request`: RFC 9457 Validation failure.
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
- **Dual Flow Architecture (Demo Simulation vs Production)**:
  - *Demo Simulation Sandbox*: Returns a pre-configured demo OTP (`123456`) in the response metadata with an educational disclaimer, while hashing and storing the challenge.
  - *Production Architecture*: Integrates with a licensed Telecom Service Provider (TSP) SMS Gateway; never echoes OTP in HTTP responses; enforces IP/device velocity rate limiting.
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "challengeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "maskedMobile": "XXXXXX1223",
        "expiresInSeconds": 120,
        "isDemoSimulation": true,
        "demoOtpNotice": "In educational demonstration mode, the simulated OTP is 123456"
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
    "challengeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "otp": "123456"
  }
  ```
- **Responses**:
  - `200 OK`: Sets cookie `ovs_session=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`; returns voter profile summary and CSRF token.
  - `400 Bad Request`: Expired or consumed challenge.
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
  - `200 OK`: Clears `ovs_session` cookie; returns `{ "success": true, "message": "Logged out successfully." }`

### 2.6 Get Current Session Profile
- **Method & Path**: `GET /api/v1/auth/me`
- **Purpose**: Returns current user profile, role, and permission scopes.
- **Auth / Role**: Authenticated (via `ovs_session` cookie).
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
  - `200 OK`: Eligible elections with assigned PC and AC and participation statuses.

### 3.4 Get Voter Participation History
- **Method & Path**: `GET /api/v1/voters/me/participation`
- **Purpose**: Returns non-sensitive demo participation receipts.
- **Auth / Role**: Authenticated (`VOTER`).
- **Responses**:
  - `200 OK`: List of participation records (zero candidate choice fields).

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
- **Purpose**: Retrieves administrative districts within a jurisdiction.
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
  1. Voter must be authenticated via valid session cookie.
  2. Election must exist and be in `POLLING_ACTIVE` status.
  3. Voter must be registered in an eligible constituency for this election.
  4. Duplicate check: Voter must not have already participated in this election (`status !== 'VOTED'`).
- **Responses**:
  - `201 Created`: Non-sensitive receipt (`demoReference`, `referenceId`, `participatedAt`).
  - `400 Bad Request`: Election not active, state mismatch, or prohibited candidate choice field supplied.
  - `409 Conflict`: Duplicate participation attempt (`ALREADY_PARTICIPATED`).

---

## 7. Counting & Results Endpoints (`/api/v1/admin/counting-sessions` & `/api/v1/results`)

### 7.1 Unified Result State Machine Statuses
The counting engine enforces a deterministic 10-state lifecycle:
1. `DRAFT`: Initial uncounted state.
2. `COUNTING_IN_PROGRESS`: Rounds are actively progressing.
3. `COUNTING_PAUSED`: Counting temporarily halted by Election Officer.
4. `COUNTING_COMPLETED`: All configured rounds have completed vote tallying.
5. `RESULT_READY_FOR_REVIEW`: Tabulations finalized and pending Returning Officer certification.
6. `PUBLISHED`: Verified results made publicly visible on portal dashboards.
7. `TIED`: Two or more candidates share identical leading votes; publication blocked.
8. `UNDER_REVIEW`: Result challenged or undergoing formal recount/scrutiny.
9. `CORRECTED`: Result amended following audit, with historical diff captured.
10. `UNPUBLISHED`: Result rescinded from public view by Super Admin.

### 7.2 Advance Counting Round (ECI Officer Action)
- **Method & Path**: `POST /api/v1/admin/counting-sessions/:sessionId/rounds`
- **Purpose**: Advances the constituency counting simulation by one round.
- **Auth / Role**: Authenticated ECI Admin (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`).
- **Scope Restriction**: `STATE_ADMIN` restricted to their state; `ELECTION_OFFICER` restricted to elections in `admin_election_scopes`.
- **Responses**:
  - `200 OK`: Returns updated round metrics, cumulative votes, and leading candidate margin.

### 7.3 Complete Counting Session
- **Method & Path**: `POST /api/v1/admin/counting-sessions/:sessionId/complete`
- **Purpose**: Concludes rounds, checks for ties, and sets status to `RESULT_READY_FOR_REVIEW`.
- **Auth / Role**: Authorized ECI Admin.
- **Validation**: All configured rounds must be processed (`currentRound >= totalConfiguredRounds`).
- **Responses**: `200 OK`.

### 7.4 Publish Constituency Result
- **Method & Path**: `POST /api/v1/admin/results/:sessionId/publish`
- **Purpose**: Publishes verified result, making it publicly visible on `/results`.
- **Auth / Role**: Authorized ECI Admin (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`).
- **Validation Preconditions**:
  1. Session status must be `RESULT_READY_FOR_REVIEW`.
  2. All configured rounds must be complete (`currentRound >= totalConfiguredRounds`).
  3. Status cannot be `TIED`.
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "isPublished": true, "status": "PUBLISHED" } }`
  - `400 Bad Request`: Precondition failed (incomplete counting session or tied result).

### 7.5 Public Results Listing & Analytics
- **Method & Path**: `GET /api/v1/results` (Public results, implicitly filtering `isPublished = true`).
- **Method & Path**: `GET /api/v1/results/analytics/lok-sabha`
- **Method & Path**: `GET /api/v1/results/analytics/assembly/:stateId`
- **Responses**: `200 OK`.

---

## 8. Administration Endpoints (`/api/v1/admin/...`)

### 8.1 ECI Officer Login
- **Method & Path**: `POST /api/v1/admin/auth/login`
- **Purpose**: Authenticates administrative officer with Officer Code and Passcode.
- **Request Body**: `{ "officerCode": "ECI-SUPER-001", "passcode": "admin123" }`
- **Responses**: `200 OK` (issues 2FA challenge).

### 8.2 Officer Election Scopes Management
- **Method & Path**: `GET /api/v1/admin/officers/:id/scopes`
- **Method & Path**: `POST /api/v1/admin/officers/:id/scopes`
  - **Body**: `{ "electionId": "LS-2029" }`
- **Method & Path**: `DELETE /api/v1/admin/officers/:id/scopes/:electionId`
- **Purpose**: Assigns or revokes specific election jurisdictions for `ELECTION_OFFICER` admins in the normalized `admin_election_scopes` table.
- **Auth / Role**: `SUPER_ADMIN` or `NATIONAL_ADMIN`.

### 8.3 Portal Announcements Management
- **Method & Path**: `POST /api/v1/admin/announcements`
- **Purpose**: Publishes portal announcements with strictly typed audience and constituency targeting.
- **Auth / Role**: `SUPER_ADMIN`, `NATIONAL_ADMIN`, or scoped `STATE_ADMIN`.
- **Request Body**:
  ```json
  {
    "title": "Polling Date Notification",
    "summary": "Official polling schedule for Kolkata South.",
    "message": "...",
    "category": "ELECTION_SCHEDULE",
    "targetAudience": "SPECIFIC_CONSTITUENCY",
    "targetStateId": "WB",
    "targetElectionId": "LS-2029",
    "targetConstituencyType": "PARLIAMENTARY",
    "targetParliamentaryConstituencyId": "PC-WB-KOLKATA-SOUTH",
    "targetAssemblyConstituencyId": null,
    "publicationDate": "2029-04-01",
    "expiryDate": "2029-04-30"
  }
  ```
- **Responses**: `201 Created`.

### 8.4 Audit Logs & 17-Rule Data Integrity
- **Method & Path**: `GET /api/v1/admin/audit-logs`
- **Method & Path**: `GET /api/v1/admin/integrity-audit`
- **Responses**: `200 OK`.
