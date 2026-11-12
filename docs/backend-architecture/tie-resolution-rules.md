# Tie Resolution Rules & Integrity Model (Phase 8.9)

## 1. Principles of Electoral Tie Resolution

Under Section 65 of the Representation of the People Act, 1951 (India), if an equality of votes is found to exist between any candidates and the addition of one vote would entitle any of those candidates to be declared elected, the Returning Officer shall decide between them by lot, and proceed as if the candidate on whom the lot falls had received an additional vote.

OVS Phase 8.9 implements this legal framework in a controlled, verifiable, and audited simulation model.

---

## 2. Tie Detection Invariants

1. **Tie Condition**:
   - A tie exists if and only if two or more candidates have the exact same highest positive vote tally:
     $$\exists c_1, c_2 \in \text{Candidates}, c_1 \neq c_2 \text{ such that } \text{votes}(c_1) = \text{votes}(c_2) = \max_{c} \text{votes}(c) > 0$$
2. **Exclusion of Zero-Vote Equality**:
   - If all candidates have 0 votes (e.g. before counting starts), this is an uncounted or zero-vote state, not a legitimate tie.
3. **Session State Transition**:
   - Upon completing counting, if a tie condition is detected, the session status transitions to `TIED` and `winningCandidateId` remains `NULL`.

---

## 3. Tie Resolution Protocol

1. **Resolution Methods**:
   - `DRAW_OF_LOTS`: The standard statutory method under Section 65 of RPA 1951.
   - `RETURNING_OFFICER_CASTING_VOTE`: Administrative fallback or designated scenario.
   - `RECOUNT_VERIFIED`: Recount confirms genuine tie.
2. **Winner Selection Constraint**:
   - The selected winner **must** be an exact member of the top-tied candidate set.
   - If candidate A (10,000 votes) and candidate B (10,000 votes) are tied, candidate C (5,000 votes) cannot be selected as the winner. Any such attempt is rejected with `ValidationProblemError` (400/422) by both application validation and PostgreSQL trigger `verify_tie_resolution_insert`.
3. **Immutability Constraint**:
   - `TieResolution` records are append-only.
   - PostgreSQL trigger `protect_tie_resolution_immutability` blocks `UPDATE` or `DELETE` on `TieResolution` once committed.
4. **Post-Resolution Transition**:
   - Upon recording a valid `TieResolution`, the session status transitions to `TIE_RESOLVED`, and `winningCandidateId` is updated to the selected candidate.
