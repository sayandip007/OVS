# Counting & Results API Contracts (Phase 8.9)

## 1. Administrative Counting Endpoints (`/api/v1/admin/counting`)

All admin counting endpoints require valid administrative session cookie and CSRF token (for mutating methods), RBAC permissions, and jurisdiction scoping.

| Method | Endpoint | Permission Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/admin/counting/sessions` | `RESULTS_MANAGE` | Create a counting session for an assigned constituency |
| `GET` | `/api/v1/admin/counting/sessions` | `RESULTS_READ` | List counting sessions with pagination and filters |
| `GET` | `/api/v1/admin/counting/sessions/:id` | `RESULTS_READ` | Retrieve counting session details, rounds, and tallies |
| `POST` | `/api/v1/admin/counting/sessions/:id/start` | `RESULTS_TALLY_MANAGE` | Start counting (transitions `DRAFT` -> `COUNTING_IN_PROGRESS`) |
| `POST` | `/api/v1/admin/counting/sessions/:id/rounds` | `RESULTS_TALLY_MANAGE` | Record a sequential counting round with cumulative tallies |
| `POST` | `/api/v1/admin/counting/sessions/:id/complete` | `RESULTS_TALLY_MANAGE` | Complete counting, detect winner or tie (`COUNTING_COMPLETED` / `TIED`) |
| `POST` | `/api/v1/admin/counting/sessions/:id/resolve-tie` | `RESULTS_TIE_RESOLVE` | Resolve tie via draw of lots / casting vote (`TIE_RESOLVED`) |
| `POST` | `/api/v1/admin/counting/sessions/:id/ready-for-review` | `RESULTS_REVIEW` | Submit completed/resolved result for review |
| `POST` | `/api/v1/admin/counting/sessions/:id/request-recount` | `RESULTS_REVIEW` | Request recount / audit review (`UNDER_REVIEW`) |
| `POST` | `/api/v1/admin/counting/sessions/:id/publish` | `RESULTS_PUBLISH` | Certify and publish results (`PUBLISHED`) |

---

## 2. Public Results Endpoints (`/api/v1/results`)

Public endpoints require no authentication. They strictly expose only `PUBLISHED` results and include mandatory simulation disclaimers.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/results` | List published results by election, state, or constituency type |
| `GET` | `/api/v1/results/:sessionId` | Retrieve certified published result with candidate tallies and winner |
| `GET` | `/api/v1/results/elections/:electionId/summary` | Aggregate summary of published results and party seat counts |

### Public Response Schema Example (`GET /api/v1/results/:sessionId`)
```json
{
  "success": true,
  "data": {
    "isSimulated": true,
    "disclaimer": "SIMULATED DEMO RESULTS - NOT OFFICIAL ELECTION DATA",
    "sessionId": "44444444-4444-4444-8444-444444444401",
    "resultStatus": "PUBLISHED",
    "election": {
      "id": "LS-2029",
      "name": "General Parliamentary Elections 2029",
      "category": "LOK_SABHA"
    },
    "constituency": {
      "type": "PARLIAMENTARY",
      "id": "WB-PC-KRISHNANAGAR",
      "name": "Krishnanagar",
      "stateName": "West Bengal"
    },
    "totalCountedVotes": 918000,
    "notaVotes": 8500,
    "rejectedVotes": 1500,
    "winner": {
      "candidateId": "CAND-LS29-WB-KN-1",
      "candidateName": "Priya Banerjee",
      "partyName": "National Democratic Front",
      "votes": 465000,
      "voteShare": 50.65,
      "margin": 23000
    },
    "candidateTallies": [
      {
        "candidateId": "CAND-LS29-WB-KN-1",
        "candidateName": "Priya Banerjee",
        "partyName": "National Democratic Front",
        "partySymbol": "Lion",
        "votes": 465000,
        "voteShare": 50.65,
        "rank": 1,
        "resultStatus": "DECLARED_WINNER"
      },
      {
        "candidateId": "CAND-LS29-WB-KN-2",
        "candidateName": "Amit Roy",
        "partyName": "United Progressive Alliance",
        "partySymbol": "Eagle",
        "votes": 442000,
        "voteShare": 48.15,
        "rank": 2,
        "resultStatus": "RUNNER_UP"
      }
    ],
    "publishedAt": "2026-06-05T12:00:00.000Z"
  }
}
```
