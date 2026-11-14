# Administrative Announcement Lifecycle State Machine

## 1. Overview & States

Administrative announcements simulate official Election Commission Gazette notifications. To prevent unauthorized, premature, or inaccurate publications, announcements must transition through an authoritative state machine:

```
  +-----------+           +------------------+           +--------------+
  |   DRAFT   | --------> |   UNDER_REVIEW   | --------> |   APPROVED   |
  +-----------+           +------------------+           +--------------+
        |                          |                            |
        |                          |                            +------------+
        | (Direct Publish allowed  | (Reject back to Draft)     |            |
        |  for SUPER_ADMIN only)   |                            v            v
        |                          |                    +-----------+  +-----------+
        +--------------------------+------------------> | PUBLISHED |  | SCHEDULED |
                                                        +-----------+  +-----------+
                                                              |              |
                                                              v              |
                                                        +-----------+        |
                                                        |  ARCHIVED | <------+
                                                        +-----------+
```

### Valid States (`AnnouncementStatus` enum):
1. **`DRAFT`**: Initial editable state. Created by authorized officers.
2. **`UNDER_REVIEW`**: Submitted for formal scrutiny. Content is locked from informal edits.
3. **`APPROVED`**: Scrutinized and certified by an authorized higher authority (`SUPER_ADMIN`, `NATIONAL_ADMIN`, or `STATE_ADMIN`). Records `approvedByAdminId`.
4. **`SCHEDULED`**: Approved announcement queued for automated publication at a specified future timestamp (`scheduledAt`).
5. **`PUBLISHED`**: Officially released announcement. Publicly accessible and dispatched to target voter inboxes. Immutable historical record.
6. **`ARCHIVED`**: Concluded announcement moved out of the active public gazette. Retained for historical audit trails.

---

## 2. Transition Matrix & Permitted Operations

| Current Status | Target Status | Required Permission | Allowed Roles | Enforcement Logic |
| :--- | :--- | :--- | :--- | :--- |
| *None* | `DRAFT` | `ANNOUNCEMENTS_CREATE` | Super Admin, National Admin, State Admin, Election Officer | Creates record; enforces jurisdiction boundary |
| `DRAFT` | `DRAFT` | `ANNOUNCEMENTS_UPDATE` | Creator, Super Admin, National Admin, State Admin | Allows content editing |
| `DRAFT` | `UNDER_REVIEW` | `ANNOUNCEMENTS_REVIEW` | Creator, Super Admin, National Admin, State Admin | Locks content; adds review notes |
| `UNDER_REVIEW` | `APPROVED` | `ANNOUNCEMENTS_APPROVE` | Super Admin, National Admin, State Admin | Records `approvedByAdminId` |
| `APPROVED` | `SCHEDULED` | `ANNOUNCEMENTS_SCHEDULE`| Super Admin, National Admin, State Admin | Requires valid future `scheduledAt` timestamp |
| `APPROVED` / `SCHEDULED` | `PUBLISHED` | `ANNOUNCEMENTS_PUBLISH` | Super Admin, National Admin, State Admin | Releases announcement; fans out notifications |
| `PUBLISHED` / `APPROVED` | `ARCHIVED` | `ANNOUNCEMENTS_ARCHIVE` | Super Admin, National Admin, State Admin | Moves to archive with optional reason |

---

## 3. Jurisdiction Scoping Rules

- **`SUPER_ADMIN` & `NATIONAL_ADMIN`**: Can author, review, approve, schedule, and publish announcements across Pan-India (`ALL_VOTERS`), any `SPECIFIC_STATE`, or any `SPECIFIC_ELECTION`.
- **`STATE_ADMIN`**: Restricted strictly to their assigned state jurisdiction. If a State Admin for West Bengal (`WB`) attempts to create or target an announcement for Maharashtra (`MH`), the request is rejected with `403 Forbidden`.
- **`ELECTION_OFFICER`**: Restricted to assigned elections and constituencies. Can author and submit drafts for review, but cannot approve or publish gazette notices directly.
- **`READ_ONLY_AUDITOR`**: Has `ANNOUNCEMENTS_READ` only. Cannot create, review, approve, schedule, or publish announcements.
