# Tally Reconciliation & Counting Integrity Model (Phase 8.9)

## 1. Principles of Tally Reconciliation

In Indian electoral procedure, counting proceeds in designated rounds, accumulating candidate votes from EVM control units along with postal ballots and rejected votes.

In OVS Phase 8.9, the tally reconciliation model guarantees strict mathematical consistency and cumulative progression across rounds.

---

## 2. Mathematical Integrity Constraints

For any counting session $S$:

$$\text{totalCountedVotes} = \sum_{c \in \text{Candidates}} \text{cumulativeVotes}(c) + \text{notaVotes} + \text{rejectedVotes}$$

### Invariants:
1. **Non-negativity**:
   - $\forall c, \text{cumulativeVotes}(c) \ge 0$
   - $\text{notaVotes} \ge 0$
   - $\text{rejectedVotes} \ge 0$
   - $\text{totalCountedVotes} \ge 0$
2. **Monotonic Non-decreasing Progression**:
   - For consecutive rounds $r$ and $r+1$:
     $$\text{cumulativeVotes}_{r+1}(c) \ge \text{cumulativeVotes}_r(c)$$
     $$\text{notaVotes}_{r+1} \ge \text{notaVotes}_r$$
     $$\text{rejectedVotes}_{r+1} \ge \text{rejectedVotes}_r$$
3. **Vote Share Computation**:
   $$\text{voteSharePercentage}(c) = \begin{cases} \dfrac{\text{cumulativeVotes}(c)}{\text{totalCountedVotes}} \times 100, & \text{if } \text{totalCountedVotes} > 0 \\ 0, & \text{otherwise} \end{cases}$$
4. **Ranking & Margin Calculation**:
   - Candidates are ordered by descending `cumulativeVotes`.
   - Rank 1 candidate has highest votes.
   - Margin of victory is computed as:
     $$\text{margin} = \text{votes}(\text{Rank 1}) - \text{votes}(\text{Rank 2})$$
   - When $\text{votes}(\text{Rank 1}) = \text{votes}(\text{Rank 2}) > 0$, $\text{margin} = 0$ and the session is classified as `TIED`.

---

## 3. Database Triggers & Verification Constraints

PostgreSQL triggers defined in `backend/prisma/migrations/20261112000700_phase_8_9_demo_counting_results/migration.sql` enforce:
- `reconcile_counting_session_votes`: Validates that `totalCountedVotes` matches the sum of candidate tallies + NOTA + rejected.
- `protect_and_reconcile_candidate_tallies`: Ensures tallies cannot be modified when session is in `COUNTING_COMPLETED` or `PUBLISHED` status without transitioning to `UNDER_REVIEW`.
- `verify_counting_round_progression`: Ensures round numbers start at 1 and increment by exactly 1 per round (`NEW.round_number = session.current_round + 1`).
- `protect_counting_session_deletion`: Prohibits deletion of counting sessions that have active rounds or published results.
