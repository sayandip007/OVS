# Participation Record Model (Phase 8.8)

> **Model**: `DemoParticipation` (`demo_participations`)  
> **Enum**: `ParticipationStatus` (`PENDING`, `PARTICIPATED`, `VOTED`, `UPCOMING`, `CLOSED`, `NOT_ELIGIBLE`)

## 1. Schema & Constraints

- **Uniqueness**: `@@unique([voterId, electionId])` enforces at most one participation record per voter per election at PostgreSQL level.
- **PC/AC Independence**: Participation in a `LOK_SABHA` election (`constituencyType = PARLIAMENTARY`, `parliamentaryConstituencyId`) is completely independent from participation in a `STATE_ASSEMBLY` election (`constituencyType = ASSEMBLY`, `assemblyConstituencyId`).
- **XOR Check Constraint**: Migration `20261112000600_phase_8_8_demo_voting_participation` enforces `chk_demo_participation_constituency_xor` so a record cannot simultaneously reference both a PC and an AC.
- **Immutability for Voters**: No `PATCH` or `DELETE` voter endpoints exist for `DemoParticipation`.

## 2. Concurrency & Race-Condition Protection

- `confirmParticipation` executes inside `prisma.$transaction`, re-validating eligibility and polling availability before insert.
- Simultaneous duplicate requests from multiple sessions for the same `(voterId, electionId)` race on `@@unique([voterId, electionId])`; PostgreSQL rejects the second insert with `P2002`, which `VotingService` translates to `409 ConflictProblemError`.
