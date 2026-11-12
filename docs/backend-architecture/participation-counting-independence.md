# Participation & Counting Independence Architecture

## 1. Foundational Constitutional Principle

In the Online Voting System (OVS), **Participation Analytics** and **Synthetic Candidate Counting Analytics** represent two strictly isolated information domains:

1. **Participation Domain (`DemoParticipation`)**:
   - Represents the civic action of casting a ballot in an educational simulation.
   - Contains only: `voterId`, `electionId`, `constituencyId`, `participatedAt`, and an anonymized participation receipt hash.
   - **Does NOT contain** candidate choice, party preference, or ballot paper content.
   - In accordance with Phase 8.8, the voter's actual candidate selection is never transmitted to, processed by, or persisted in the database.

2. **Counting Domain (`CountingSession`, `CandidateTally`, `CountingRound`)**:
   - Represents independent, synthetic counting simulations recorded by election officers.
   - Contains candidate tally numbers, NOTA counts, and rejected votes entered by authorised administrators during counting rounds.
   - **Does NOT derive from, query, reconcile against, or depend upon `DemoParticipation`.**

---

## 2. Technical Safeguards & Anti-Correlation Controls

```
+-------------------------------------------------------------+
|              DATABASE & QUERY ISOLATION BOUNDARY            |
+-------------------------------------------------------------+
|                                                             |
|   TABLE: DemoParticipation        TABLE: CandidateTally     |
|   - id                            - id                      |
|   - voterProfileId                - countingSessionId       |
|   - electionId                    - candidateNominationId   |
|   - constituencyId                - votes                   |
|   - participatedAt                - rank                    |
|                                                             |
|           NO FOREIGN KEY OR RELATIONSHIP BETWEEN THEM       |
|                 NO SHARED COMPOSITE IDENTIFIER              |
|                                                             |
+-------------------------------------------------------------+
```

### 2.1 Code-Level Enforcement
1. **Zero SQL Joins**:
   The `AnalyticsService` codebase strictly prohibits joining `DemoParticipation` with `CandidateTally` or `CountingSession`. Every query is isolated:
   - Participation counts are queried solely via `prisma.demoParticipation.count(...)` or `prisma.demoParticipation.findMany(...)`.
   - Counting tallies are queried solely via `prisma.candidateTally.findMany(...)` or `prisma.countingSession.findMany(...)`.
2. **Independent Aggregation Functions**:
   `getVoterParticipationAnalytics()` queries demographic breakdowns and hourly turnout without touching any candidate or party data.
   `getCountingResultsSummary()` aggregates candidate tallies without querying any voter records or participation logs.
3. **No Cross-Inference on Dashboards**:
   Although both participation turnout rates and candidate winning tallies may be presented on adjacent widgets in the administrator dashboard (`BackendAnalyticsDashboard.jsx`), the UI clearly labels them as independent datasets and provides explicit educational simulation disclaimers.

---

## 3. Privacy Masking & $k$-Anonymity Guarantees

To prevent indirect deduction of demographic voting patterns:
- Subgroups with sample sizes smaller than $k = 5$ (e.g., specific age brackets or genders in small rural polling areas) are masked to prevent microdata de-anonymization.
- The participation rate is mathematically bounded:
  $$\text{TurnoutRate} = \min\left(100.00, \frac{\text{participatedCount}}{\max(1, \text{registeredCount})} \times 100\right)$$
- If an election has zero registered voters in a newly created constituency, the turnout rate safely defaults to `0.00%`.
