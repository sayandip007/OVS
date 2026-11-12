# Election Schedule Validation Rules (Phase 8.7)

> **Status**: Implemented (Phase 8.7)  
> **Module**: `backend/src/modules/elections/election.schedule.validator.ts`

## 1. IANA Timezone & Milestone Structure

- Timezone names are validated via `Intl.DateTimeFormat(undefined, { timeZone })`. Invalid timezone strings (e.g., `Mars/Olympus`) are rejected.
- Duplicate `milestoneType` entries within a single schedule payload are rejected (`DUPLICATE_MILESTONE`).
- When both `startAt` and `endAt` are provided on a milestone, `endAt >= startAt` is enforced (`INVALID_MILESTONE_WINDOW`).

## 2. Chronological Ordering

Configured milestones are checked in canonical sequence:
`NOMINATION_OPEN` → `NOMINATION_CLOSE` → `SCRUTINY` → `WITHDRAWAL_DEADLINE` → `CAMPAIGN_START` → `CAMPAIGN_END` → `POLLING_START` → `POLLING_END` → `COUNTING_START` → `RESULT_DECLARATION`.

Any out-of-order timestamp emits a structured `CHRONOLOGY_VIOLATION` issue.

## 3. Draft Flexibility vs Mandatory Readiness

- **Draft Editing (`requireMandatory: false`)**: Admins may save incomplete schedules (only a subset of milestones) while an election is being prepared, provided the milestones that *are* supplied are chronologically valid.
- **Readiness / Review (`requireMandatory: true`)**: Readiness validation (`GET /configuration/validation` and `POST /configuration/submit`) requires all 8 mandatory milestones: `NOMINATION_OPEN`, `NOMINATION_CLOSE`, `SCRUTINY`, `WITHDRAWAL_DEADLINE`, `POLLING_START`, `POLLING_END`, `COUNTING_START`, `RESULT_DECLARATION`.
