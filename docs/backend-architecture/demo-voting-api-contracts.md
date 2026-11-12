# Demo Voting API Contracts (Phase 8.8)

## 1. Voter Endpoints (`/api/v1/voter`, requires `VOTER` session)

| Method & Path | CSRF | Purpose |
|---|---:|---|
| `GET /api/v1/voter/elections` | No | Discover eligible/available Lok Sabha & State Assembly demo elections |
| `GET /api/v1/voter/elections/:electionId` | No | Single election discovery detail for authenticated voter |
| `GET /api/v1/voter/elections/:electionId/eligibility` | No | Detailed eligibility & polling window check |
| `GET /api/v1/voter/elections/:electionId/ballot` | No | Retrieve approved candidates for voter's server-resolved PC or AC |
| `POST /api/v1/voter/elections/:electionId/participation` | Yes | Record participation (`{}` body only; rejects `candidateId`/extra keys with `422`) |
| `GET /api/v1/voter/participation` | No | List voter's own participation history (zero candidate choices) |
| `GET /api/v1/voter/elections/:electionId/participation` | No | Get voter's participation confirmation for one election |

## 2. Admin Participation Aggregate Endpoints (`/api/v1/admin/elections`, requires `participation.aggregate.read`)

| Method & Path | Purpose |
|---|---|
| `GET /api/v1/admin/elections/:electionId/participation/summary` | Total eligible, total participated, percentage, PC/AC breakdown |
| `GET /api/v1/admin/elections/:electionId/participation/constituencies` | Per-constituency aggregate counts (no voter PII) |
| `GET /api/v1/admin/elections/:electionId/participation/timeline` | Hourly UTC participation count buckets (no voter PII) |
