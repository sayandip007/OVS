# OVS Phase 8.6 — Candidate-Party Historical Integrity

1. **Independent vs. Party XOR**: Database constraint `chk_nomination_independent_party_xor` enforces `(is_independent = TRUE AND party_id IS NULL) OR (is_independent = FALSE AND party_id IS NOT NULL)`.
2. **Nomination Party Snapshot**: `CandidateNomination` stores `partyNameSnapshot`, `partyAbbreviationSnapshot`, and `partyTypeSnapshot` at nomination time.
3. **Immutable History**: Updating `Candidate.partyId` or `PoliticalParty.status` never rewrites existing `CandidateNomination` rows.
4. **Constituency Compatibility (Phase 8.7 Dependency)**: Every nomination is validated against `election_constituencies` (matching PostgreSQL trigger `verify_candidate_nomination_integrity`). Full bulk constituency-assignment UI/APIs will be completed in Phase 8.7.
