# OVS Phase 8.6 — Nomination Lifecycle State Machine

Defined in [`nomination.lifecycle.ts`](..\..\backend\src\modules\nominations\nomination.lifecycle.ts) using `CandidateNominationStatus`:

| From | To | Endpoint | Permission | Notes |
|---|---|---|---|---|
| `DRAFT` | `SUBMITTED` | `POST /submit` | `nominations.submit` | Verifies active candidate & party |
| `SUBMITTED` | `UNDER_REVIEW` | `POST /review` | `nominations.review` | Records reviewer & timestamp |
| `SUBMITTED` | `WITHDRAWN` | `POST /withdraw` | `nominations.withdraw` | Requires reason >= 5 chars |
| `UNDER_REVIEW` | `APPROVED` | `POST /approve` | `nominations.approve` | Enforces separation of duties (`submitter != approver`) |
| `UNDER_REVIEW` | `REJECTED` | `POST /reject` | `nominations.reject` | Requires reason >= 5 chars |
| `UNDER_REVIEW` | `WITHDRAWN` | `POST /withdraw` | `nominations.withdraw` | Requires reason >= 5 chars |
| `APPROVED` | `WITHDRAWN` | `POST /withdraw` | `nominations.withdraw` | Preserves historical record |

Optimistic concurrency (`expectedVersion`) returns `409 Conflict` on concurrent review updates.
