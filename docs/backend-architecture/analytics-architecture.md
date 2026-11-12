# Analytics Architecture — Unified Monitoring, Reporting & Performance Design

## 1. Executive Overview

Phase 8.10 establishes an enterprise-grade, read-only analytics, reporting, and dashboard engine for the Online Voting System (OVS). The analytics module provides real-time visibility and statistical aggregation across five core election operational domains:
1. **National Election Overview**: System-wide voter turnout, election counts, constituency distribution, and candidate nomination statistics.
2. **State-Level Dashboards**: State-scoped aggregated metrics, parliamentary and assembly constituency coverage, and state-level voter registration counts.
3. **Election-Specific & Constituency Analytics**: Granular per-election metrics, scheduled vs active milestones, constituency participation aggregates, and candidate seat allocations.
4. **Voter Participation Statistics**: Hourly voter turnout curves, age cohort demographics, gender distribution, and verification status aggregates—strictly privacy-safe with $k$-anonymity thresholding.
5. **Counting & Result Publication Statistics**: Certified winner counts, leading margins, party vote share summaries, and tie resolution logs.

---

## 2. Core Architectural Principles

```
+-----------------------------------------------------------------------------------+
|                            ANALYTICS SERVICE ARCHITECTURE                         |
+-----------------------------------------------------------------------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
      [ Participation Domain ]                             [ Counting Domain ]
                |                                                   |
     +---------------------+                             +---------------------+
     |  DemoParticipation  |                             |   CountingSession   |
     |    (Binary Flag)    |                             |   CandidateTally    |
     +---------------------+                             +---------------------+
                \                                                   /
                 \                 STRICT PRIVACY BARRIER          /
                  +-----------------------------------------------+
                  |  NEVER JOINED, CORRELATED, DERIVED, OR LINKED |
                  +-----------------------------------------------+
                                          |
                        +-----------------------------------+
                        |   Analytics Aggregation Engine    |
                        |   - Privacy Thresholding (k >= 5) |
                        |   - Scope-Keyed Cache (TTL 15s)   |
                        |   - Jurisdiction Access Gates     |
                        +-----------------------------------+
                                          |
                 +------------------------+------------------------+
                 |                                                 |
       [ Admin Analytics APIs ]                          [ Public Analytics APIs ]
         /api/v1/admin/analytics                          /api/v1/public/analytics
```

### 2.1 The Two-Domain Isolation Principle
A fundamental architectural guarantee in OVS is the absolute logical and physical separation between:
1. **Participation Domain** (`DemoParticipation`, `VoterProfile`): Records *who* participated in an election and at what timestamp, along with high-level demographic aggregates.
2. **Counting Domain** (`CountingSession`, `CandidateTally`, `CountingRound`): Records *candidate votes*, tallies, margins, and certified outcomes.

These two domains are aggregated through distinct, isolated database queries. Under no circumstance are SQL joins, subqueries, or programmatic correlations executed between individual voter records and candidate vote counts.

### 2.2 Strict Zero-PII & Aggregation Thresholding
- **Zero Individual Data**: Analytics queries return only aggregated totals, percentages, and categorized buckets.
- **$k$-Anonymity Minimum Threshold ($k \ge 5$)**: To prevent re-identification through small cohort subtraction attacks (e.g., in low-population constituencies or specialized demographic slices), any demographic sub-bucket with fewer than 5 respondents is suppressed and returned as `null` or grouped into a generic `"Other / Suppressed"` bucket.
- **Participation Rate Capping**: Calculated as $\min(100.00, \frac{\text{participatedCount}}{\text{registeredCount}} \times 100)$ with a guaranteed denominator fallback of 0 when registration is zero.

### 2.3 Scope-Keyed In-Memory Caching
To protect the primary PostgreSQL database from analytical aggregation overhead:
- Aggregated responses are cached in-memory with a short Time-To-Live (TTL: 15 seconds).
- Cache keys incorporate the requesting administrator's jurisdiction role and geographic scope:
  $$\text{CacheKey} = \text{Domain} : \text{ScopeRole} : \text{ScopeState} : \text{ScopeElection} : \text{QueryParams}$$
- Any mutation in election state, counting tallies, or nominations triggers immediate scope invalidation via `invalidateCache()`.

---

## 3. Jurisdiction Scoping Matrix for Analytics

| Role | Permitted Analytics Scopes | Enforcement Mechanism |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Global (National, All States, All Elections, Audit Logs) | Full access across all scopes |
| `NATIONAL_ADMIN` | Global (National, All States, All Elections, Participation, Counting) | Full access excluding root system audit |
| `STATE_ADMIN` | Scoped to assigned `State` | `assertJurisdiction`: Throws 403 if `stateId` differs from assigned state |
| `ELECTION_OFFICER` | Scoped to assigned `Election` or `Constituency` | Throws 403 if target election does not match assignment |
| `READ_ONLY_AUDITOR` | Global Read-Only across all domains & exports | Full read-only access with zero mutation permissions |
| Public / Unauthenticated | Published elections and certified results only | Restricted via `/api/v1/public/analytics` endpoints |

---

## 4. Query Performance & Aggregation Strategy

1. **Selective Indexed Queries**: Aggregations leverage composite indices on:
   - `DemoParticipation(electionId, constituencyId, participatedAt)`
   - `CountingSession(electionId, constituencyId, status)`
   - `CandidateTally(countingSessionId, candidateNominationId)`
2. **Streaming and Bounded Processing**: Export routines paginate database queries in batches of 1,000 records to prevent memory bloat during CSV and JSON generation.
3. **Stateless Transformation**: The analytics controller transforms database counts directly into presentation DTOs with standardized RFC 9457 error translation.
