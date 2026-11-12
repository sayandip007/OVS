# Demo Voting Architecture (Phase 8.8)

> **Status**: Implemented (Phase 8.8)  
> **Scope**: Educational Indian election simulation — ballot presentation, volatile client-side selection, and participation-only server confirmation.

## 1. End-to-End Flow

1. **Voter Election Discovery**: Authenticated voter calls `GET /api/v1/voter/elections`. The backend resolves the voter's authoritative `VoterProfile` (`parliamentaryConstituencyId` and `assemblyConstituencyId`) from the session and evaluates each non-draft election independently.
2. **Ballot Retrieval**: Voter opens `/voter/elections/:electionId/ballot`. Frontend calls `GET /api/v1/voter/elections/:electionId/ballot`. Backend verifies election operational state (`POLLING_ACTIVE`), approved configuration (`configReviewStatus = APPROVED`), configured polling window (`Asia/Kolkata` / UTC), server-side constituency mapping, and returns only `APPROVED` nominations for active candidates.
3. **Volatile Candidate Selection**: Selected candidate ID is held exclusively in component-local React `useState(null)` inside `BallotPage.jsx` — never in `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or URLs.
4. **Participation Confirmation**: Upon final confirmation, frontend sends `POST /api/v1/voter/elections/:electionId/participation` with an **empty body `{}`** and CSRF token. Backend creates a `DemoParticipation` record inside a database transaction (`@@unique([voterId, electionId])`).
5. **Non-Sensitive Receipt & History**: Receipt (`/voter/elections/:electionId/receipt`) and History (`/voter/history`) display election, constituency, timestamp, `PARTICIPATED` status, and `demoReference` — zero candidate or party data.
