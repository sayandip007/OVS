# Notification & Communication Architecture

## 1. System Overview

Phase 8.11 introduces a comprehensive, multi-channel communication infrastructure for the Online Voting System (OVS). The notification system unifies:
1. **In-App Voter Notification Centre**: Real-time alerts, unread counters, mark-as-read workflows, and voter-controlled notification preferences.
2. **Administrative Gazette & Announcements**: A multi-stage lifecycle (Draft -> Review -> Approved -> Scheduled -> Published -> Archived) for pan-India, state, election, and constituency advisories.
3. **Safe Email Delivery Abstraction**: Provider-agnostic message pipeline with `DevelopmentEmailProvider` as the fail-closed default, HTML injection escaping, and plaintext alternatives.
4. **Outbox Queue & Retry Management**: Transactional delivery logging (`NotificationDelivery`), bounded retries, exponential backoff ($2^n \times 1\text{ min}$), and manual administrative retry.
5. **Event-Driven Dispatcher**: Decoupled listener triggering simulated electoral notifications from committed business events.

---

## 2. Notification System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                        OVS EVENT-DRIVEN NOTIFICATION SYSTEM                       |
+-----------------------------------------------------------------------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
    [ Domain Business Events ]                            [ Admin Gazette Actions ]
    - Election Announced                                  - Create / Edit Draft
    - Nomination Deadline Approaching                     - Submit for Review
    - Polling Hours Open / Closed                         - Approve & Schedule
    - Results Certified & Published                       - Publish & Archive
                |                                                   |
                +-------------------------+-------------------------+
                                          |
                        +-----------------------------------+
                        |      NotificationsService         |
                        |      - Audience & Jurisdiction    |
                        |      - Recipient Preference Check |
                        |      - Template & Disclaimer Bind |
                        +-----------------------------------+
                                          |
                 +------------------------+------------------------+
                 |                                                 |
      [ In-App Storage ]                                  [ Outbox Delivery Queue ]
      Table: voter_notifications                          Table: notification_deliveries
      - Immediate User Visibility                         - Status: PENDING / SENT
      - Unread Count Tracking                             - Exponential Backoff Retries
      - Strict IDOR Protection                            - Provider: Development / SMTP
```

---

## 3. Security & Privacy Guarantees

1. **Strict Zero Voter-Choice Leakage**:
   - Notifications and announcements never contain, reference, or derive from a voter's candidate selection or private ballot choice.
   - Event reminders are broadcast uniformly based on geographical eligibility (Constituency / State / Pan-India), never based on individual voting choices.
2. **Strict In-App IDOR Protection**:
   - Endpoints under `/api/v1/notifications` strictly bind to the authenticated voter session (`req.user.voterProfile.id`).
   - Querying, marking as read, or deleting notifications belonging to another voter is blocked with `403 Forbidden`.
3. **Fail-Closed Development Email Mode**:
   - By default, `EMAIL_PROVIDER=DEVELOPMENT`.
   - Outbound emails are stored in an inspectable in-memory outbox array (`DevelopmentEmailProvider`).
   - Real SMTP network transmissions are impossible unless `EMAIL_DELIVERY_ENABLED=true` and explicit production SMTP parameters are configured.
4. **HTML & Formula Sanitization**:
   - All user-supplied text in notifications and emails is escaped with `escapeHtml` to neutralize XSS/HTML injection.
   - Text is stripped to plain text via `htmlToPlainText` to guarantee RFC 2822 compliance.
5. **Educational Simulation Disclaimers**:
   - Every email, in-app alert, and API payload carries mandatory simulation notices:
     `"NOTICE: This communication is generated as part of the Online Voting System (OVS) educational simulation. It does NOT represent a legally binding election event."`
