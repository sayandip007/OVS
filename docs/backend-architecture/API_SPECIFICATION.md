# OVS REST API Specification (v1 - Phase 8.1.2 Hardened)

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

### 2.4 Resend OTP & Logout
- `POST /api/v1/auth/otp/resend`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

---

## 3. Voter Profile & Elections Endpoints (`/api/v1/voters`)

- `GET /api/v1/voters/me`: Retrieves authenticated voter's personal details and dual-constituency assignment.
- `PATCH /api/v1/voters/me`: Updates non-electoral personal details (email, mobile, address).
- `GET /api/v1/voters/me/elections`: Computes eligible elections based on voter's dual PC/AC mapping.
- `GET /api/v1/voters/me/participation`: Returns non-sensitive demo participation receipts.

---

## 4. Geography Endpoints (`/api/v1/geography`)

- `GET /api/v1/geography/states`
- `GET /api/v1/geography/states/:stateId/districts`
- `GET /api/v1/geography/parliamentary-constituencies`
- `GET /api/v1/geography/assembly-constituencies`

---

## 5. Elections, Parties & Candidates (`/api/v1/...`)

- `GET /api/v1/elections`
- `GET /api/v1/elections/:electionId`
- `GET /api/v1/parties`
- `GET /api/v1/elections/:electionId/candidates`: Returns approved contesting candidates matching election and constituency.
- `POST /api/v1/admin/candidates/:candidateId/nominations`: Files candidate nomination, validating Section 33(7) RPA 1951 (maximum 2 active nominations per candidate per election across constituencies).

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
- **Responses**:
  - `201 Created`: Non-sensitive receipt (`demoReference`, `referenceId`, `participatedAt`).
  - `400 Bad Request`: Election not active, state mismatch, or prohibited candidate choice field supplied.
  - `409 Conflict`: Duplicate participation attempt (`ALREADY_PARTICIPATED`).

---

## 7. Counting & Results Endpoints (`/api/v1/admin/counting-sessions` & `/api/v1/results`)

### 7.1 Unified Result State Machine Statuses
The counting engine enforces a deterministic 10-state lifecycle:
`DRAFT` → `COUNTING_IN_PROGRESS` → `COUNTING_PAUSED` / `COUNTING_COMPLETED` → `RESULT_READY_FOR_REVIEW` → `PUBLISHED`
Auxiliary states: `TIED`, `UNDER_REVIEW`, `CORRECTED`, `UNPUBLISHED`.

### 7.2 Advance Counting Round
- **Method & Path**: `POST /api/v1/admin/counting-sessions/:sessionId/rounds`
- **Purpose**: Advances the constituency counting simulation by one round.
- **Auth / Role**: Authenticated ECI Admin (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`, `ELECTION_OFFICER`).
- **Responses**: `200 OK` (returns updated round metrics, cumulative votes, and leading candidate margin).

### 7.3 Complete Counting Session
- **Method & Path**: `POST /api/v1/admin/counting-sessions/:sessionId/complete`
- **Purpose**: Concludes rounds, executes vote reconciliation (`total_counted_votes = SUM(tallies) + nota + rejected`), checks for ties, and sets status to `RESULT_READY_FOR_REVIEW` (or `TIED` if equal votes).
- **Validation**: All configured rounds must be processed (`currentRound >= totalConfiguredRounds`).
- **Responses**: `200 OK`.

### 7.4 Publish Constituency Result
- **Method & Path**: `POST /api/v1/admin/results/:sessionId/publish`
- **Purpose**: Publishes verified result, making it publicly visible on `/results`.
- **Auth / Role**: Authorized ECI Admin (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`).
- **Mandatory Preconditions**:
  1. Current session status MUST be `RESULT_READY_FOR_REVIEW` (cannot publish directly from `DRAFT` or `COUNTING_COMPLETED`).
  2. All configured rounds must be complete (`currentRound >= totalConfiguredRounds`).
  3. Status cannot be `TIED`.
  4. Winner must be declared.
  5. Automatically sets `isPublished = true`, `status = 'PUBLISHED'`, `publishedAt = NOW()`, and `publishedByAdminId = admin.id`.
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "isPublished": true, "status": "PUBLISHED" } }`
### 7.5 Statutory Tie Resolution (Section 102 RPA 1951)
- **Method & Path**: `POST /api/v1/admin/counting-sessions/:sessionId/resolve-tie`
- **Purpose**: Records legal tie resolution evidence (draw of lots / coin toss by Returning Officer) when a session is in `TIED` state.
- **Auth / Role**: Authorized Returning Officer / ECI Admin (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `STATE_ADMIN`).
- **Request Body**:
  ```json
  {
    "resolutionMethod": "DRAW_OF_LOTS",
    "selectedCandidateId": "CAND-01",
    "notes": "Tie broken by draw of lots conducted in presence of candidate election agents pursuant to RPA 1951 Section 102.",
    "documentRef": "ECI/ELEC/2029/RO-LOTS-001"
  }
  ```
- **Behavior**:
  1. Verifies that counting session is in status `TIED`.
  2. Verifies that `selectedCandidateId` is one of the tied contesting candidates.
  3. Inserts an immutable row into `tie_resolutions`.
  4. Updates `counting_sessions`: sets `winner_candidate_id = selectedCandidateId`, `lead_margin = 1`, and advances status to `RESULT_READY_FOR_REVIEW`.
- **Responses**:
  - `200 OK`: Returns created tie resolution record and updated session.
  - `400 Bad Request`: Session is not tied, or candidate is not eligible.

### 7.6 Result Correction & Recount
- **Method & Path**: `POST /api/v1/admin/results/:sessionId/review` (Places session `UNDER_REVIEW`).
- **Method & Path**: `POST /api/v1/admin/results/:sessionId/correct`
  - **Body**: `{ "reason": "Administrative recounting audit adjustment.", "correctedTallies": [...] }`
  - **Behavior**: Records previous state and amended state into `result_correction_history`, sets status to `CORRECTED`, and requires returning to `RESULT_READY_FOR_REVIEW` before re-publishing.

### 7.7 Unpublish Result
- **Method & Path**: `POST /api/v1/admin/results/:sessionId/unpublish`
  - **Auth / Role**: `SUPER_ADMIN`.
  - **Behavior**: Sets `isPublished = false` and status to `UNPUBLISHED`.

### 7.8 Public Results Listing & Analytics
- `GET /api/v1/results` (Public results, implicitly filtering `isPublished = true`).
- `GET /api/v1/results/analytics/lok-sabha`
- `GET /api/v1/results/analytics/assembly/:stateId`
- `GET /api/v1/results/:sessionId/export/csv`

---

## 8. Administration Endpoints (`/api/v1/admin/...`)

- `POST /api/v1/admin/auth/login`
- `GET /api/v1/admin/officers/:id/scopes`
- `POST /api/v1/admin/officers/:id/scopes`
- `DELETE /api/v1/admin/officers/:id/scopes/:electionId`
- `POST /api/v1/admin/announcements`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/integrity-audit`
