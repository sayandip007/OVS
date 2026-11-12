# OVS Phase 8.5 — Election Audit & Lifecycle History

Every election management mutation writes transactionally to `election_lifecycle_history` (within the Prisma `$transaction` updating `elections`) and records a sanitized security event in `admin_action_logs`:

- **Recorded Actions**: `ELECTION_CREATED`, `METADATA_UPDATED` / `ELECTION_UPDATED`, `STATUS_TRANSITION` / `ELECTION_STATUS_TRANSITIONED`, `ELECTION_CANCELLED`, `ELECTION_ARCHIVED`, `ELECTION_ACCESS_DENIED`, `ELECTION_CREATE_DENIED`.
- **Attribution & Correlation**: Captures `electionId`, `changedByAdminId` / `adminUserId`, `actorIdentifier`, `actorRole`, `fromStatus`, `toStatus`, `note`, `requestId`, and `changedAt` timestamp.
- **Immutability**: No `PATCH`, `PUT`, or `DELETE` endpoints exist for `election_lifecycle_history` or `admin_action_logs`.
- **Sanitization**: Passwords, session tokens, CSRF tokens, and cookies are never logged (`AdminAuditService.sanitizeDetails`).
