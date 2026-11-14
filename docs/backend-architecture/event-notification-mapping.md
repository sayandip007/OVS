# Event-to-Notification Mapping Specification

## 1. Event Dispatch Architecture

In Phase 8.11, domain notifications are decoupled from database operations. Instead of sending notifications inside database transactions or SQL triggers, domain services emit structured domain events upon successful transaction commit.

The `NotificationsService.handleElectionEvent()` processor receives the event payload, evaluates voter eligibility and preferences, and generates:
1. An immutable in-app notification in `voter_notifications`.
2. A queued email delivery record in `notification_deliveries` (if the voter has explicitly enabled email alerts and possesses a verified email address).

---

## 2. Event-to-Notification Matrix

| Domain Event | NotificationType Enum | Target Audience | In-App Subject Template | Email Template |
| :--- | :--- | :--- | :--- | :--- |
| `ELECTION_ANNOUNCED` | `ELECTION_ANNOUNCEMENT` | All registered voters in election jurisdiction | `Simulated Election Announced: <Title>` | `renderElectionAnnounced` |
| `NOMINATION_PERIOD_OPENED` | `NOMINATION_SCHEDULE` | Prospective candidates & party officers | `Nomination Period Open: <Title>` | `renderGeneralAnnouncement` |
| `NOMINATION_DEADLINE_APPROACHING` | `NOMINATION_SCHEDULE` | Prospective candidates & constituency voters | `Nomination Cutoff Approaching: <Title>` | `renderNominationDeadlineApproaching` |
| `CANDIDATE_LIST_PUBLISHED` | `CANDIDATE_LIST` | Constituency voters | `Final Candidate List Published: <Constituency>` | `renderGeneralAnnouncement` |
| `POLLING_SCHEDULE_APPROACHING` | `POLLING_SCHEDULE` | Registered voters in participating seats | `Demo Polling Reminder: <Title>` | `renderPollingScheduleReminder` |
| `POLLING_PERIOD_OPENED` | `POLLING_SCHEDULE` | Registered voters in participating seats | `Demo Polling is Now Open: <Title>` | `renderPollingOpened` |
| `POLLING_PERIOD_CLOSED` | `POLLING_SCHEDULE` | Registered voters in participating seats | `Demo Polling Concluded: <Title>` | `renderPollingClosed` |
| `COUNTING_STARTED` | `GENERAL_ANNOUNCEMENT` | Constituency voters & public | `Counting Started: <Constituency>` | `renderGeneralAnnouncement` |
| `COUNTING_COMPLETED` | `GENERAL_ANNOUNCEMENT` | Constituency voters & public | `Counting Milestone: <Constituency> (Round X)` | `renderCountingProgress` |
| `RESULTS_PUBLISHED` | `RESULT_PUBLISHED` | Constituency voters & public | `Demo Results Certified: <Constituency>` | `renderResultsPublished` |

---

## 3. Voter Notification Preference Filtering

Before an event generates an alert for a specific voter, the system verifies `notification_preferences`:
1. If `inAppEnabled = false` and `electionReminders = false`, the in-app notification is suppressed.
2. If `emailEnabled = false`, no record is created in `notification_deliveries`.
3. If `voter.isVerified = false`, email delivery is blocked to prevent spamming unverified addresses.
4. Voters can customize their preferences at any time via `PATCH /api/v1/notifications/preferences`.
