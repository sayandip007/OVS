# Election Schedule Model (Phase 8.7)

> **Status**: Implemented (Phase 8.7)  
> **Timezone Policy**: UTC storage (`TIMESTAMPTZ` / `DateTime`), `Asia/Kolkata` default display/input timezone.

## 1. Schema & Tables

- **`Election` extensions**:
  - `scheduleTimezone` (`String`, default `'Asia/Kolkata'`)
  - `scheduleVersion` (`Int`, default `1`, positive check constraint `chk_election_schedule_version_positive`)
- **`ElectionScheduleMilestone` (`election_schedule_milestones`)**:
  - Unique per `(electionId, milestoneType)`
  - Fields: `milestoneType` (`ScheduleMilestoneType`), `startAt` (`DateTime?`), `endAt` (`DateTime?`), `timezone` (`String`), `status` (`CONFIGURED | ACTIVE | COMPLETED | SKIPPED`), `note`, `createdByAdminId`, `updatedByAdminId`
  - DB Check Constraint: `chk_schedule_milestone_start_before_end` ensures `end_at IS NULL OR start_at IS NULL OR end_at >= start_at`.
- **`ElectionScheduleHistory` (`election_schedule_history`)**:
  - Immutable audit trail recording `SCHEDULE_REPLACED`, `MILESTONE_UPDATED`, `SCHEDULE_VALIDATED`, `scheduleVersion`, `previousState`, `nextState`, `changedByAdminId`, and `requestId`.

## 2. Optimistic Concurrency & Public Exposure

- `PUT /api/v1/admin/elections/:electionId/schedule` and `PATCH /api/v1/admin/elections/:electionId/schedule/:milestoneId` accept `expectedScheduleVersion` and return `409 ConflictProblemError` on stale writes.
- Public `GET /api/v1/elections/:electionId/schedule` hides `DRAFT`, `CANCELLED`, and `ARCHIVED` elections (`404`) and omits internal admin IDs and internal notes.
