# Ballot Privacy Model (Phase 8.8)

> **Invariant**: Candidate choices are NEVER transmitted to, logged by, or stored on the backend.

## 1. Strict Privacy Boundaries

- **Database Layer (`DemoParticipation`)**:
  - Contains `id`, `voterId`, `electionId`, `constituencyType`, `parliamentaryConstituencyId`, `assemblyConstituencyId`, `status`, `demoReference`, `referenceId`, `participatedAt`, `recordedAt`, `metadata`.
  - Contains **zero** `candidateId`, `partyId`, `selection`, `ballotChoice`, `selectionHash`, or `CandidateTally` foreign keys.
- **API & Validation Layer**:
  - `participationConfirmBodySchema = z.object({}).strict()` rejects any request body containing unexpected fields (`candidateId`, `partyId`, `selection`, `ballotChoice`, `selectionHash`, etc.) with `422 ValidationProblemError`.
- **Logging & Telemetry Layer**:
  - `backend/src/common/middleware/logger.ts` explicitly redacts `candidateId`, `partyId`, `selectedCandidateId`, `ballotChoice`, `selection`, `selectionHash`, and `req.body.*` equivalents.
- **Frontend Layer**:
  - `selectedCandidateId` exists solely in volatile React component memory and is cleared on unmount, election change, cancel, session expiry, and post-confirmation.

## 2. Known Demo Limitations

- Because candidate selection is intentionally never sent to the server, the backend cannot cryptographically verify whether a browser user clicked a candidate card before sending `POST /participation`. This is an accepted, documented design trade-off of an educational participation-only simulation.
- Phase 8.9 demo counting/results will operate as an independent simulation dataset and will never reconstruct choices from `DemoParticipation`.
