# OVS Architecture Decision Records (ADRs) (Phase 8.1.2 Hardened)

## Index of Architectural Decisions

- [ADR-001: Modular Monolith vs. Microservices](#adr-001-modular-monolith-vs-microservices)
- [ADR-002: PostgreSQL 16 & Prisma ORM Selection](#adr-002-postgresql-16--prisma-orm-selection)
- [ADR-003: Strict Decoupling of Voter Participation and Counting Simulation](#adr-003-strict-decoupling-of-voter-participation-and-counting-simulation)
- [ADR-004: Dual-Constituency (Parliamentary & Assembly) Relational Schema](#adr-004-dual-constituency-parliamentary--assembly-relational-schema)
- [ADR-005: Server-Authoritative 5-Role RBAC with Normalized Scoping (AdminElectionScope)](#adr-005-server-authoritative-5-role-rbac-with-normalized-scoping-adminelectionscope)
- [ADR-006: Centralized Simulation Clock & Chronological State Machine](#adr-006-centralized-simulation-clock--chronological-state-machine)
- [ADR-007: Adapter-Based Incremental Frontend Migration with Dual-Mode Support](#adr-007-adapter-based-incremental-frontend-migration-with-dual-mode-support)
- [ADR-008: Pure HttpOnly Secure Cookie Sessions & Triple-Layer CSRF Defense](#adr-008-pure-httponly-secure-cookie-sessions--triple-layer-csrf-defense)
- [ADR-009: Zod Schema Validation & RFC 9457 Problem Details Contracts](#adr-009-zod-schema-validation--rfc-9457-problem-details-contracts)
- [ADR-010: Provenance Tracking (VERIFIED_OFFICIAL vs. DEMO_SAMPLE)](#adr-010-provenance-tracking-verified_official-vs-demo_sample)
- [ADR-011: Partial Unique Indexes & Check Constraints for Nullable Composite Uniqueness](#adr-011-partial-unique-indexes--check-constraints-for-nullable-composite-uniqueness)
- [ADR-012: Composite Foreign Keys for Multi-Level Geographic Hierarchy Enforcement](#adr-012-composite-foreign-keys-for-multi-level-geographic-hierarchy-enforcement)
- [ADR-013: Candidate-Party Consistency Enforcement in Tallies via Composite Foreign Key](#adr-013-candidate-party-consistency-enforcement-in-tallies-via-composite-foreign-key)
- [ADR-014: Explicit Prisma-to-PostgreSQL Column Mapping (@map) Convention](#adr-014-explicit-prisma-to-postgresql-column-mapping-map-convention)
- [ADR-015: Result Publication Hardening & Review Gate State Machine](#adr-015-result-publication-hardening--review-gate-state-machine)
- [ADR-016: Statutory Multiple Nomination Support (Section 33(7) RPA 1951)](#adr-016-statutory-multiple-nomination-support-section-337-rpa-1951)
- [ADR-017: Counting Mathematical Reconciliation & Monotonic Round Progression](#adr-017-counting-mathematical-reconciliation--monotonic-round-progression)

---

### ADR-001: Modular Monolith vs. Microservices
- **Status**: Accepted
- **Decision**: Adopt a modular monolith in Node.js 22 with Express and TypeScript. Domain modules (`geography`, `elections`, `candidates`, `counting`) maintain clear folder boundaries and communicate through typed in-process services.

---

### ADR-002: PostgreSQL 16 & Prisma ORM Selection
- **Status**: Accepted
- **Decision**: Use PostgreSQL 16 as the relational store, managed via Prisma ORM for type-safe database queries and automated migration history, supplemented with custom SQL migrations (`CUSTOM_DATABASE_INTEGRITY.sql`).

---

### ADR-003: Strict Decoupling of Voter Participation and Counting Simulation
- **Status**: Accepted
- **Decision**: The `demo_participations` table contains **only** `{ voter_id, election_id, status: 'VOTED', demo_reference, reference_id, participated_at, recorded_at }`. There is **no candidate or party column**. Candidate tallies exist in `candidate_tallies`, populated purely from deterministic simulation seeds or administrative round simulations.

---

### ADR-004: Dual-Constituency (Parliamentary & Assembly) Relational Schema
- **Status**: Accepted
- **Decision**: Model `VoterProfile` with two foreign keys: `parliamentary_constituency_id` and `assembly_constituency_id`. Furthermore, model `AssemblyConstituency` with `parent_parliamentary_constituency_id` reflecting official delimitation.

---

### ADR-005: Server-Authoritative 5-Role RBAC with Normalized Scoping (AdminElectionScope)
- **Status**: Accepted
- **Decision**: Enforce role permissions and scope constraints in Express middleware (`requireAdminScope`). Normalize `ELECTION_OFFICER` assignments into a dedicated `AdminElectionScope` relation (`admin_election_scopes` table).

---

### ADR-006: Centralized Simulation Clock & Chronological State Machine
- **Status**: Accepted
- **Decision**: Standardize on a centralized reference clock (`2029-04-20`) in `DEMO_CLOCK_CONFIG`. Election status transitions enforce strict chronology: `nominationStartDate <= ... <= pollingStartDate <= pollingEndDate <= countingDate <= resultDate`.

---

### ADR-007: Adapter-Based Incremental Frontend Migration with Dual-Mode Support
- **Status**: Accepted
- **Decision**: Implement an adapter pattern in frontend service modules (`electionService.js`, `storageService.js`) governed by `VITE_DATA_SOURCE_MODE` (`LOCAL_DEMO` vs `BACKEND_API`).

---

### ADR-008: Pure HttpOnly Secure Cookie Sessions & Triple-Layer CSRF Defense
- **Status**: Accepted
- **Decision**: Standardize exclusively on signed, `HttpOnly`, `Secure`, `SameSite=Strict` cookies (`ovs_session`). Enforce triple-layer CSRF defense: `SameSite=Strict` attribute, mandatory `X-CSRF-Token` header on mutating requests, and server-side `Origin` / `Referer` validation.

---

### ADR-009: Zod Schema Validation & RFC 9457 Problem Details Contracts
- **Status**: Accepted
- **Decision**: Define runtime Zod validation schemas for every API endpoint. Format all errors using the RFC 9457 Problem Details specification (`application/problem+json`).

---

### ADR-010: Provenance Tracking (VERIFIED_OFFICIAL vs. DEMO_SAMPLE)
- **Status**: Accepted
- **Decision**: Add `metadataSource` enum (`VERIFIED_OFFICIAL` | `DEMO_SAMPLE`) to all geography, party, candidate, and election tables.

---

### ADR-011: Partial Unique Indexes & Check Constraints for Nullable Composite Uniqueness
- **Status**: Accepted
- **Decision**: Implement dual Partial Unique Indexes in PostgreSQL for `election_constituencies`, `candidate_nominations`, and `counting_sessions`. Enforce mutual exclusivity via PostgreSQL `CHECK` constraints.

---

### ADR-012: Composite Foreign Keys for Multi-Level Geographic Hierarchy Enforcement
- **Status**: Accepted
- **Decision**: Establish composite unique keys `District @@unique([id, stateId])`, `ParliamentaryConstituency @@unique([id, stateId])`, and `AssemblyConstituency @@unique([id, parentParliamentaryConstituencyId])`. Enforce composite foreign keys in `assembly_constituencies` and `voter_profiles`.

---

### ADR-013: Candidate-Party Consistency Enforcement in Tallies via Composite Foreign Key
- **Status**: Accepted
- **Decision**: Establish composite unique key `Candidate @@unique([id, partyId])` and bind `CandidateTally` with composite foreign key `(candidateId, partyId) REFERENCES candidates(id, partyId)`.

---

### ADR-014: Explicit Prisma-to-PostgreSQL Column Mapping (@map) Convention
- **Status**: Accepted (Phase 8.1.2 Added)
- **Context**: In PostgreSQL, `snake_case` is standard. Prisma generates column names matching model property names in camelCase unless explicitly annotated with `@map()`. Without `@map()`, custom SQL references like `election_id` would fail against a table generated with column name `electionId`.
- **Decision**: Explicitly declare `@map("snake_case_column")` on every camelCase property in all 24 models. Use `@@map("snake_case_table")` on all models.
- **Consequences**: Guarantees 100% naming synchronization between Prisma Client, raw SQL scripts, indices, foreign keys, and triggers.

---

### ADR-015: Result Publication Hardening & Review Gate State Machine
- **Status**: Accepted (Phase 8.1.2 Added)
- **Context**: Premature publication directly from `DRAFT` or `COUNTING_COMPLETED` bypasses essential scrutiny. Direct database inserts could insert published records without rounds.
- **Decision**: Implement the trigger `trg_verify_counting_session_publication` covering both `INSERT` and `UPDATE` operations:
  - On `INSERT`: sessions must be initialized in `DRAFT`.
  - On `UPDATE`: publication (`is_published = true`) is only permitted from `RESULT_READY_FOR_REVIEW`, requiring `current_round >= total_configured_rounds`, `status != 'TIED'`, and non-null `published_by_admin_id`.
- **Consequences**: Results cannot bypass the formal Returning Officer certification stage.

---

### ADR-016: Statutory Multiple Nomination Support (Section 33(7) RPA 1951)
- **Status**: Accepted (Phase 8.1.2 Added)
- **Context**: Section 33(7) of the *Representation of the People Act, 1951* permits a candidate to contest from up to two constituencies in a general election. The previous `@@unique([candidateId, electionId])` prevented this legitimate electoral scenario.
- **Decision**: Replace `@@unique([candidateId, electionId])` with partial unique indexes enforcing per-constituency candidate uniqueness (`uq_nomination_candidate_election_pc` and `uq_nomination_candidate_election_ac`). Enforce the statutory ceiling of at most 2 active nominations per candidate per election via trigger `trg_verify_candidate_nomination_compatibility`.
- **Consequences**: Conforms to Indian statutory election law while preventing duplicate nominations in the same constituency.

---

### ADR-017: Counting Mathematical Reconciliation & Monotonic Round Progression
- **Status**: Accepted (Phase 8.1.2 Added)
- **Context**: Independent simulation rounds could theoretically produce conflicting vote totals, decreasing cumulative tallies, or out-of-order rounds.
- **Decision**: Define the mathematical reconciliation formula:
  $$\text{total\_counted\_votes} = \sum (\text{candidate\_tallies.votes}) + \text{nota\_votes} + \text{rejected\_votes}$$
  Enforce reconciliation on session completion via `trg_reconcile_counting_session_votes`. Enforce sequential, non-decreasing round progression via `trg_verify_counting_round_progression`.
- **Consequences**: Guarantees numerical integrity and prevents corrupted tally states.

---

### ADR-018: Advisory Transaction Locking for Candidate Nomination Ceiling
- **Status**: Accepted (Phase 8.1.3 Added)
- **Context**: In high-concurrency environments, concurrent transactions attempting to insert nominations for the same candidate in the same election could both execute the `SELECT COUNT(*)` check before either commits, allowing more than 2 active nominations to bypass the limit.
- **Decision**: Implement `PERFORM pg_advisory_xact_lock(hashtext('candidate_nomination_limit:' || candidate_id || ':' || election_id))` inside trigger `trg_verify_candidate_nomination_compatibility`.
- **Consequences**: Serializes nomination limit verification on the exact `(candidate_id, election_id)` pair without locking the entire table or causing false deadlocks. Automatically released on transaction commit/abort.

---

### ADR-019: Bidirectional Vote Reconciliation & Completed Counting Immutability
- **Status**: Accepted (Phase 8.1.3 Added)
- **Context**: Previous reconciliation only fired on `counting_sessions` updates, leaving `candidate_tallies` vulnerable to post-completion mutation. Furthermore, zero-vote candidate tallies bypassed reconciliation.
- **Decision**: Make vote reconciliation bidirectional:
  1. Remove bypass conditions: `COALESCE(SUM(votes), 0)` reconciles zero-vote and empty tally states.
  2. Protect candidate tallies with trigger `trg_protect_and_reconcile_candidate_tallies` on `INSERT`, `UPDATE`, and `DELETE`.
  3. Lock the session row `FOR UPDATE` to obtain a consistent snapshot and forbid mutating tallies when session is `COUNTING_COMPLETED`, `RESULT_READY_FOR_REVIEW`, or `PUBLISHED`.
- **Consequences**: Guarantees that neither session totals nor candidate tallies can drift out of mathematical sync.

---

### ADR-020: Publication State & Flag Structural Equivalence
- **Status**: Accepted (Phase 8.1.3 Added)
- **Context**: Potential state ambiguity where `status = 'PUBLISHED'` exists while `is_published = false`, or vice versa.
- **Decision**: Add declarative engine-level CHECK constraint:
  `CHECK ((status = 'PUBLISHED' AND is_published = TRUE) OR (status != 'PUBLISHED' AND is_published = FALSE))`
  combined with initial state constraint:
  `CHECK (NOT (current_round = 0 AND total_counted_votes = 0 AND is_published = TRUE))`
  and trigger validation requiring all configured rounds to physically exist before publication.
- **Consequences**: Impossible for status and flag to disagree even on raw SQL updates outside the application.

---

### ADR-021: Strict Reverse-Order Counting Round Rollback & Deletion Guard
- **Status**: Accepted (Phase 8.1.3 Added)
- **Context**: Arbitrary round deletion or modification of early rounds could corrupt cumulative totals and delta relationships.
- **Decision**:
  1. Trigger `trg_protect_counting_round_deletion` forbids deleting rounds in completed/published sessions and requires rollback in strict reverse chronological order ($N, N-1, \dots$).
  2. Trigger `trg_verify_counting_round_progression` forbids modifying earlier rounds when later rounds exist.
  3. Trigger `trg_synchronize_session_current_round` automatically keeps `counting_sessions.current_round` aligned with `MAX(round_number)`.
- **Consequences**: Counting progression is tamper-evident and protected against out-of-order manipulation.

---

### ADR-022: Aggregate Counting Rounds with Round Leader Validation (Option B Selection)
- **Status**: Accepted (Phase 8.1.3 Added)
- **Context**: Evaluate whether to add an extra relational child model `RoundTally` (Option A) vs maintaining aggregate round progression with validated round leaders (Option B).
- **Decision**: Adopt Option B. Counting rounds store aggregate statistics (`round_votes`, `cumulative_votes`, `lead_margin`) with `lead_candidate_id` strictly verified to hold an `APPROVED` nomination in the session. Detailed candidate breakdowns reside in `candidate_tallies`.
- **Consequences**: Matches existing frontend simulation architecture, preserves the 24-model schema, avoids artificial table bloat, and provides verifiable data integrity.

