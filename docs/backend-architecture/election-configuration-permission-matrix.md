# Election Configuration Permission Matrix (Phase 8.7)

> **Status**: Implemented (Phase 8.7)  
> **Sources**: `backend/src/modules/admin/admin.permissions.ts` and `src/services/adminPermissionService.js`

| Permission | `SUPER_ADMIN` | `NATIONAL_ADMIN` | `STATE_ADMIN` (Scoped) | `ELECTION_OFFICER` (Scoped) | `READ_ONLY_AUDITOR` |
|---|:---:|:---:|:---:|:---:|:---:|
| `elections.constituencies.read` | Yes | Yes | Yes | Yes | Yes |
| `elections.constituencies.manage` | Yes | Yes | Yes | No | No |
| `elections.constituencies.bulk_manage` | Yes | Yes | Yes | No | No |
| `elections.schedule.read` | Yes | Yes | Yes | Yes | Yes |
| `elections.schedule.manage` | Yes | Yes | Yes | No | No |
| `elections.configuration.validate` | Yes | Yes | Yes | Yes | Yes |
| `elections.configuration.submit` | Yes | Yes | Yes | No | No |
| `elections.configuration.review` | Yes | Yes | No | No | No |
| `elections.configuration.approve` | Yes | Yes | No | No | No |

- `STATE_ADMIN`: Restricted to `STATE_ASSEMBLY` elections within `assignedStateIds` and constituencies belonging to their assigned state(s); cannot approve/review election configuration.
- `ELECTION_OFFICER`: Restricted to `assignedElectionIds` for read/validate operations only; blocked (`403`) from all constituency, schedule, and review mutations.
- `READ_ONLY_AUDITOR`: Strictly read/validate only; blocked (`403`) from all mutations.
