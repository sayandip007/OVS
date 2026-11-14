# OVS REST API Reference & Specification

**Base URL:** `/api/v1`  
**Authentication:** Cookie-Based Sessions (`HttpOnly`, `SameSite=Strict`, `Secure` in production)  
**Security Headers:** Helmet CSP, HSTS, X-Content-Type-Options, Anti-CSRF (`x-csrf-token`)  
**Standard Error Format:** RFC 7807 Problem Details (`application/problem+json`)  

---

## 1. Authentication & Session Endpoints

### `POST /api/v1/auth/request-otp`
Initiates synthetic OTP challenge for registered voter.
- **Body:** `{ "mobile": "9800008801" }`
- **Response (200):** `{ "challengeId": "uuid", "expiresAt": "ISOString" }`

### `POST /api/v1/auth/verify-otp`
Validates challenge and issues voter session cookie.
- **Body:** `{ "challengeId": "uuid", "code": "582910" }`
- **Response (200):** `{ "voter": { "id": "uuid", "fullName": "...", "epicNumber": "..." } }`

### `POST /api/v1/admin/login`
Authenticates administrator via officer code and scrypt password.
- **Body:** `{ "officerCode": "ECI-SUPER-DEMO", "password": "..." }`
- **Response (200):** `{ "admin": { "id": "uuid", "role": "SUPER_ADMIN", "fullName": "..." } }`

### `POST /api/v1/admin/logout`
Revokes active administrative session and invalidates cookie.
- **Response (204):** No Content.

---

## 2. Voter Participation & Secret Ballot Endpoints

### `GET /api/v1/voting/ballot?electionId={id}`
Retrieves approved candidates and ballot layout for voter's mapped constituency.
- **Response (200):**
  ```json
  {
    "electionId": "LS-2029",
    "constituency": { "id": "WB-PC-KOLKATA-SOUTH", "name": "Kolkata South" },
    "candidates": [
      { "id": "CAND-01", "name": "Mahua Mitra", "party": "AITC", "symbolUrl": "..." }
    ],
    "hasParticipated": false
  }
  ```

### `POST /api/v1/voting/participate`
**CRITICAL PRIVACY INVARIANT:** Records that voter participated. Must reject candidate choices.
- **Body Schema:** `z.object({ electionId: z.string() }).strict()`
- **Allowed Body:** `{ "electionId": "LS-2029" }`
- **Rejected Body (422):** `{ "electionId": "LS-2029", "candidateId": "CAND-01" }`
- **Response (201):** `{ "status": "PARTICIPATED", "referenceId": "DEMO-REF-...", "recordedAt": "..." }`
- **Duplicate Response (409):** `{ "title": "Conflict", "detail": "Voter has already participated." }`

---

## 3. Election & Nomination Endpoints

### `GET /api/v1/elections`
List public elections with state and type filters.
- **Query Params:** `?type=LOK_SABHA|STATE_ASSEMBLY&stateId=WB`
- **Response (200):** Array of election summaries.

### `POST /api/v1/elections` *(Admin: ELECTIONS_CREATE)*
Create new election and initial draft schedule.
- **Body:** `{ "name": "...", "type": "LOK_SABHA", "stateId": null }`

### `POST /api/v1/nominations/{id}/scrutiny` *(Admin: NOMINATIONS_REVIEW)*
Approve or reject candidate nomination.
- **Body:** `{ "decision": "APPROVED", "scrutinyNote": "Verified documents." }`

---

## 4. Independent Counting & Results Endpoints

### `GET /api/v1/results/published`
Public access to certified and published election results.
- **Query Params:** `?electionId=LS-2029`

### `POST /api/v1/results/counting/{sessionId}/rounds` *(Admin: RESULTS_TALLY_MANAGE)*
Submit synthetic round tallies for constituency counting session.
- **Body:**
  ```json
  {
    "roundNumber": 2,
    "tallies": [
      { "candidateId": "CAND-01", "votes": 3500 },
      { "candidateId": "CAND-02", "votes": 2800 }
    ],
    "notaVotes": 150,
    "rejectedVotes": 50
  }
  ```

### `POST /api/v1/results/counting/{sessionId}/tie-break` *(Admin: RESULTS_TIE_RESOLVE)*
Resolve detected tie using statutory procedure.
- **Body:**
  ```json
  {
    "selectedWinnerId": "CAND-01",
    "resolutionMethod": "LOTTERY_DRAW",
    "justificationNote": "Witnessed lottery draw per Section 102."
  }
  ```

---

## 5. System Administration & Diagnostics Endpoints

### `GET /health` / `GET /ready` / `GET /live`
System health and readiness probes. Returns HTTP 200 with JSON status.

### `GET /metrics`
Prometheus metrics scrape target (`text/plain; version=0.0.4`).

### `POST /api/v1/admin/system/maintenance` *(Admin: SETTINGS_MANAGE)*
Toggle maintenance mode state.
- **Body:** `{ "state": "SCHEDULED_MAINTENANCE", "message": "Upgrades in progress." }`
