# OVS Phase 8.6 — Nomination Permission & Jurisdiction Matrix

| Permission | `SUPER_ADMIN` | `NATIONAL_ADMIN` | `STATE_ADMIN` | `ELECTION_OFFICER` | `READ_ONLY_AUDITOR` |
|---|---|---|---|---|---|
| `candidates.read` / `parties.read` / `nominations.read` / `nominations.history.read` | Yes | Yes | Scoped (State) | Scoped (Election) | Scoped Read-Only |
| `candidates.create` / `candidates.update` | Yes | Yes | Scoped (State) | Scoped (Election) | No |
| `candidates.deactivate` / `parties.create` / `parties.update` | Yes | Yes | Scoped (State; no `NATIONAL` parties) | No | No |
| `nominations.create` / `submit` / `review` / `approve` / `reject` / `withdraw` | Yes | Yes | Scoped (State) | Scoped (Election) | No |

All `POST`/`PATCH` mutations require `X-CSRF-Token`, active `ADMIN` session, and server-side jurisdiction verification.
