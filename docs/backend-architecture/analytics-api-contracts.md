# Analytics API Contracts & Endpoint Specifications

## 1. Overview & Base URIs

All administrative analytics endpoints are mounted under `/api/v1/admin/analytics` and require administrative bearer token authentication (`requireAdminAuth`) and specific fine-grained permissions (`requirePermission`).
Public analytics endpoints are mounted under `/api/v1/public/analytics` and are accessible without authentication.

All responses include standard educational simulation headers:
- `X-Simulation-Notice: "This data represents an educational simulation of election statistics"`
- `X-Simulation-Warning: "Synthetic data for educational demonstration only"`

---

## 2. Administrative Endpoints (`/api/v1/admin/analytics`)

### 2.1 GET `/national-overview`
- **Required Permission**: `ANALYTICS_READ` or `ANALYTICS_READ_NATIONAL`
- **Jurisdiction Rules**: Accessible to `SUPER_ADMIN`, `NATIONAL_ADMIN`, `READ_ONLY_AUDITOR`.
- **Response Shape (200 OK)**:
```json
{
  "totalElections": 14,
  "activeElections": 3,
  "completedElections": 8,
  "totalStates": 36,
  "totalParliamentaryConstituencies": 543,
  "totalAssemblyConstituencies": 4120,
  "totalRegisteredVoters": 1250000,
  "totalDemoParticipations": 845000,
  "overallParticipationRate": 67.6,
  "totalCandidates": 3420,
  "totalParties": 58,
  "electionsByCategory": {
    "LOK_SABHA": 2,
    "STATE_ASSEMBLY": 12
  },
  "electionsByStatus": {
    "DRAFT": 2,
    "SCHEDULED": 1,
    "ACTIVE": 3,
    "COMPLETED": 8
  }
}
```

### 2.2 GET `/state-dashboard`
- **Required Permission**: `ANALYTICS_READ` or `ANALYTICS_READ_STATE`
- **Query Parameters**:
  - `stateId` (string, required): 2-character state code (e.g. `WB`, `DL`, `MH`).
- **Jurisdiction Rules**: `STATE_ADMIN` may only request their assigned `stateId`. `SUPER_ADMIN`, `NATIONAL_ADMIN`, and `READ_ONLY_AUDITOR` can query any valid state.
- **Response Shape (200 OK)**:
```json
{
  "stateId": "WB",
  "stateName": "West Bengal",
  "parliamentaryConstituenciesCount": 42,
  "assemblyConstituenciesCount": 294,
  "electionsCount": 3,
  "registeredVotersCount": 142000,
  "demoParticipationsCount": 102500,
  "participationRate": 72.18,
  "activeCountingSessionsCount": 1,
  "publishedResultsCount": 2,
  "elections": [
    {
      "id": "elec-wb-001",
      "title": "West Bengal Legislative Assembly General Election 2026",
      "category": "STATE_ASSEMBLY",
      "status": "ACTIVE",
      "participationsCount": 102500
    }
  ]
}
```

### 2.3 GET `/election-summary`
- **Required Permission**: `ANALYTICS_READ` or `ANALYTICS_READ_ELECTION`
- **Query Parameters**:
  - `electionId` (string, required): UUID or ID of the election.
- **Response Shape (200 OK)**:
```json
{
  "electionId": "elec-wb-001",
  "title": "West Bengal Legislative Assembly General Election 2026",
  "category": "STATE_ASSEMBLY",
  "status": "ACTIVE",
  "stateId": "WB",
  "assignedConstituenciesCount": 294,
  "totalNominatedCandidates": 882,
  "approvedCandidatesCount": 850,
  "registeredVotersInJurisdiction": 142000,
  "participationsCount": 102500,
  "participationRate": 72.18,
  "countingSessionsSummary": {
    "totalSessions": 294,
    "draft": 0,
    "inProgress": 10,
    "completed": 284,
    "published": 280
  }
}
```

### 2.4 GET `/voter-participation`
- **Required Permission**: `ANALYTICS_READ` or `ANALYTICS_READ_PARTICIPATION`
- **Query Parameters**:
  - `electionId` (string, optional): Scopes turnout to a single election.
  - `stateId` (string, optional): Scopes turnout to a state.
  - `constituencyId` (string, optional): Scopes turnout to a constituency.
- **Privacy Rules**: All subgroups with $< 5$ respondents are suppressed.
- **Response Shape (200 OK)**:
```json
{
  "electionId": "elec-wb-001",
  "totalRegistered": 142000,
  "totalParticipated": 102500,
  "overallRate": 72.18,
  "hourlyTurnout": [
    { "hour": "07:00", "count": 12050, "cumulativeRate": 8.49 },
    { "hour": "08:00", "count": 18400, "cumulativeRate": 21.44 }
  ],
  "demographics": {
    "genderDistribution": {
      "MALE": { "count": 52100, "percentage": 50.83 },
      "FEMALE": { "count": 49800, "percentage": 48.59 },
      "OTHER": { "count": 600, "percentage": 0.58 }
    },
    "ageCohorts": {
      "18-25": 21500,
      "26-40": 42000,
      "41-60": 26000,
      "60+": 13000
    }
  }
}
```

### 2.5 GET `/counting-results-summary`
- **Required Permission**: `ANALYTICS_READ` or `ANALYTICS_READ_COUNTING`
- **Query Parameters**:
  - `electionId` (string, required): ID of target election.
- **Response Shape (200 OK)**:
```json
{
  "electionId": "elec-wb-001",
  "totalConstituencies": 294,
  "countedConstituencies": 284,
  "publishedConstituencies": 280,
  "partyWiseWins": {
    "AITC": 210,
    "BJP": 65,
    "INC": 4,
    "IND": 1
  },
  "averageVictoryMargin": 14250,
  "totalVotesCounted": 9850000,
  "notaVotesCounted": 125000,
  "rejectedVotesCounted": 5200
}
```

### 2.6 GET `/audit-activity`
- **Required Permission**: `ANALYTICS_READ` or `ANALYTICS_READ_AUDIT`
- **Query Parameters**:
  - `limit` (number, default: 50, max: 200)
  - `offset` (number, default: 0)
- **Response Shape (200 OK)**:
```json
{
  "totalLogs": 412,
  "logs": [
    {
      "id": "audit-uuid-1",
      "action": "COUNTING_RESULT_PUBLISHED",
      "adminUsername": "stateadmin_wb",
      "resourceType": "COUNTING_SESSION",
      "resourceId": "cs-krishnanagar-01",
      "timestamp": "2026-11-12T16:00:00.000Z",
      "ipAddress": "127.0.0.1"
    }
  ]
}
```

### 2.7 GET `/export`
- **Required Permission**: `ANALYTICS_EXPORT`
- **Query Parameters**:
  - `reportType` (enum: `NATIONAL_OVERVIEW`, `STATE_DASHBOARD`, `ELECTION_SUMMARY`, `VOTER_PARTICIPATION`, `COUNTING_RESULTS`): Required.
  - `format` (enum: `CSV`, `JSON`): Required.
  - `electionId` (string, optional)
  - `stateId` (string, optional)
- **Content-Type**:
  - For CSV: `text/csv; charset=utf-8`
  - For JSON: `application/json; charset=utf-8`
- **Security**: All text fields in CSV are sanitized against spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`).

---

## 3. Public Analytics Endpoints (`/api/v1/public/analytics`)

### 3.1 GET `/public/summary`
Returns national overview metrics for published and completed elections only.

### 3.2 GET `/public/election/:id`
Returns turnout and certified candidate tallies for completed or active elections, ensuring zero voter PII is exposed.
