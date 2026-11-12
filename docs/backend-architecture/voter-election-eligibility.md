# Voter Election Eligibility & Schedule Enforcement (Phase 8.8)

> **Scope**: Synthetic demo-profile eligibility only (not real-world EPIC/ECI verification).

## 1. Authoritative Server-Side Mapping

- Browser-supplied constituency IDs are never accepted on voter endpoints.
- `LOK_SABHA`: Resolves `VoterProfile.parliamentaryConstituencyId` (`PARLIAMENTARY`).
- `STATE_ASSEMBLY`: Verifies `VoterProfile.stateId === Election.stateId` and resolves `VoterProfile.assemblyConstituencyId` (`ASSEMBLY`).

## 2. Gate Evaluation Order

`VotingService.evaluateEligibility` checks:
1. Election type supported (`LOK_SABHA` or `STATE_ASSEMBLY`).
2. Voter profile has required constituency mapping (`MISSING_CONSTITUENCY_MAPPING`) and state scope (`OUT_OF_JURISDICTION`).
3. Voter has not already participated (`ALREADY_PARTICIPATED`).
4. Election status (`CANCELLED` → `ELECTION_CANCELLED`, `ARCHIVED` → `ELECTION_ARCHIVED`, pre-polling → `ELECTION_NOT_STARTED`, post-polling → `ELECTION_CLOSED`, requires `POLLING_ACTIVE`).
5. Constituency is assigned to the election (`CONSTITUENCY_NOT_ASSIGNED`).
6. Configuration approved (`configReviewStatus === 'APPROVED'`) and polling window configured (`CONFIGURATION_INCOMPLETE` if missing).
7. Effective demo clock (`election.simulationClockDate ?? now()`) falls within `[pollingStart, pollingEnd]` (`Asia/Kolkata` display, UTC storage).
8. At least one `APPROVED` nomination for an active candidate exists in the voter's constituency (`NO_APPROVED_CANDIDATES`).
