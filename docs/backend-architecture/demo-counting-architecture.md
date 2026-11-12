# Independent Demo Counting Architecture (Phase 8.9)

> **Core Architectural Invariant**: Demo counting data is completely synthetic and independent. It is NEVER generated from, derived from, aggregated from, or reconciled against `DemoParticipation` records or individual voter candidate selections.

---

## 1. Architectural Overview & Boundaries

The Online Voting System (OVS) is an educational Indian election simulation. In accordance with strict ballot privacy requirements established in Phase 8.8:
- Individual ballots and candidate selections are never transmitted to, logged by, or stored in the backend.
- `DemoParticipation` records exclusively voter turnout (`voterId`, `electionId`, `constituencyId`, timestamp, reference ID) with zero candidate or party fields.
- Counting sessions (`CountingSession`), counting rounds (`CountingRound`), candidate tallies (`CandidateTally`), and tie resolutions (`TieResolution`) operate in a completely isolated database domain.
- Synthetic demo tally numbers are recorded by authorized election officers or administrators to simulate the post-poll counting and tabulation process in Indian parliamentary and assembly elections.

---

## 2. Counting Data Model & Relational Boundaries

```
           +--------------------+
           |      Election      |
           +---------+----------+
                     |
                     | 1:N
                     v
           +--------------------+
           |  CountingSession   |
           +----+----------+----+
                |          |
       1:N      |          | 1:N
   +------------+          +------------+
   |                                    |
   v                                    v
+------------------+           +------------------+
|  CandidateTally  |           |  CountingRound   |
+------------------+           +------------------+
   |
   | (at most 1)
   v
+------------------+
|  TieResolution   |
+------------------+
```

### Relational Entity Responsibilities
1. **`CountingSession`**:
   - Represents the counting and tabulation session for an assigned constituency in an election.
   - Enforces uniqueness per `(electionId, parliamentaryConstituencyId)` or `(electionId, assemblyConstituencyId)`.
   - Tracks current lifecycle status (`ResultStatus`: `DRAFT` -> `COUNTING_IN_PROGRESS` -> `COUNTING_COMPLETED` -> `RESULT_READY_FOR_REVIEW` -> `PUBLISHED`), total counted votes, nota votes, rejected votes, margin of victory, and winning candidate.
2. **`CandidateTally`**:
   - Tracks cumulative tally, percentage, rank, and result status for each approved candidate in the constituency.
   - Strictly validates `cumulativeVotes >= 0`.
3. **`CountingRound`**:
   - Represents a discrete tabulation round (e.g. EVM control unit round).
   - Validates that round numbers advance strictly sequentially (`1, 2, 3...`) without gaps.
   - Preserves snapshot of candidate votes, NOTA votes, and rejected votes for audit traceability.
4. **`TieResolution`**:
   - Immutable record created only when two or more top candidates share the exact same highest vote tally.
   - Records the tie resolution method (`DRAW_OF_LOTS`, `RETURNING_OFFICER_CASTING_VOTE`, etc.), candidate tied set, declared winner, and witnessed audit notes.
5. **`ResultCorrectionHistory`**:
   - Captures any administrative tally adjustments or recount reasons made while a session is under review.

---

## 3. Separation of Duties & Jurisdiction Scoping

- **Administrative Roles**:
  - `SUPER_ADMIN`: Full national access to create, record rounds, complete, review, publish, and resolve ties.
  - `NATIONAL_ADMIN`: National access to oversee, review, publish, and audit counting sessions.
  - `STATE_ADMIN`: Scoped to constituencies within their designated state.
  - `ELECTION_OFFICER`: Limited strictly to their assigned election and constituency for tally entry and counting progress.
  - `READ_ONLY_AUDITOR`: Read-only access across all counting sessions, tallies, and audit logs. Zero mutation permissions (`RESULTS_TALLY_MANAGE`, `RESULTS_PUBLISH`, etc. are denied).
- **Public Results Boundary**:
  - Public endpoints (`/api/v1/results`) expose only `PUBLISHED` results.
  - All public result outputs prominently display the mandatory educational disclaimer:
    `"SIMULATED DEMO RESULTS - NOT OFFICIAL ELECTION DATA"`.
