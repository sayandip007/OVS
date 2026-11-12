# Election Configuration Review & Readiness Workflow (Phase 8.7)

> **Status**: Implemented (Phase 8.7)

## 1. Readiness Validation (`GET /api/v1/admin/elections/:electionId/configuration/validation`)

Non-mutating readiness inspection returning `{ electionId, configReviewStatus, ready, assignedConstituenciesCount, configuredMilestonesCount, issues }`:
1. Verifies `STATE_ASSEMBLY` elections have a valid `stateId`.
2. Verifies at least one compatible constituency is assigned (`NO_CONSTITUENCIES_ASSIGNED`), and all assigned constituencies match the election type & state.
3. Verifies complete mandatory schedule milestones and chronological ordering (`requireMandatory: true`).
4. Verifies all existing `CandidateNomination` rows reference currently assigned constituencies (`ORPHAN_NOMINATION_CONSTITUENCY`).

## 2. Review States & Separation of Duties

`ConfigurationReviewStatus` lifecycle:
- `DRAFT` → `SUBMITTED_FOR_REVIEW` (`POST /configuration/submit`, blocked if readiness fails)
- `SUBMITTED_FOR_REVIEW` → `UNDER_REVIEW` (`POST /configuration/review`)
- `SUBMITTED_FOR_REVIEW` | `UNDER_REVIEW` → `APPROVED` (`POST /configuration/approve`)
- `SUBMITTED_FOR_REVIEW` | `UNDER_REVIEW` → `RETURNED_FOR_CORRECTION` (`POST /configuration/return` with mandatory reason `>= 5` chars)
- `RETURNED_FOR_CORRECTION` → `SUBMITTED_FOR_REVIEW` (after corrections)

**Separation of Duties**: `approveConfiguration` enforces `election.configSubmittedByAdminId !== actor.id` (`403 ForbiddenProblemError`), preventing self-approval.

**Post-Approval Invalidation**: Any modification to constituency assignments or schedule milestones on an `APPROVED` configuration automatically resets `configReviewStatus` to `DRAFT` and clears prior approval metadata.
