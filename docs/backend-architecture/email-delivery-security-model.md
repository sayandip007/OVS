# Email Delivery Security Model & Provider Architecture

## 1. Threat Model & Design Principles

Email notification systems in voting and electoral contexts face unique security risks:
1. **Accidental Leakage in Non-Production**: Sending test emails to real voter addresses during integration tests, manual QA, or development.
2. **HTML / Script Injection (XSS)**: Malicious actors attempting to inject JavaScript, tracking pixels, or phishing links into announcement messages.
3. **Email Header & Command Injection**: User-controlled inputs breaking email protocol headers (`\r\nBcc:...`).
4. **Voter Privacy Exposure**: Revealing who voted, candidate choices, or unverified contact data.

---

## 2. Provider Abstraction Architecture

The notification engine decouples email generation from transmission using the `EmailDeliveryProvider` interface:

```typescript
export interface EmailDeliveryProvider {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<EmailDeliveryResult>;
}
```

### 2.1 Development Mode (`DevelopmentEmailProvider`)
- **Default State**: Active whenever `EMAIL_PROVIDER` is unset or set to `DEVELOPMENT`.
- **Zero Real Transmissions**: Intercepts all email requests in memory. No network sockets or SMTP connections are opened.
- **Inspectable Outbox**: All messages are recorded in an in-memory queue (`getOutbox()`) for unit and integration test assertions.
- **Fail-Closed Protection**: Even if a developer configures real voter email addresses in development or test fixtures, no outbound email can escape.

### 2.2 Production SMTP Mode (`SMTPEmailProvider`)
- Requires explicit configuration:
  - `EMAIL_PROVIDER=SMTP`
  - `EMAIL_DELIVERY_ENABLED=true`
  - `EMAIL_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`
- If `EMAIL_DELIVERY_ENABLED` is missing or `false`, the provider safely rejects delivery attempts and records `status = FAILED` in `NotificationDelivery`.

---

## 3. Template Sanitization & Plaintext Alternatives

1. **Mandatory HTML Escaping**:
   All user-supplied content (announcement titles, summaries, messages, voter names, constituency titles) is filtered through `escapeHtml()`:
   ```typescript
   export function escapeHtml(str: string): string {
     return String(str)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#039;');
   }
   ```
2. **Dual-Body MIME Compliance**:
   Every email template generates both an HTML body and a sanitized plain-text alternative via `htmlToPlainText()`, ensuring compatibility with terminal mail clients and accessibility tools.
3. **Mandatory Educational Simulation Disclaimer**:
   Appended prominently to all outbound email footers:
   ```
   NOTICE: This communication is generated as part of the Online Voting System (OVS) educational simulation.
   It does NOT represent a legally binding election event, official government notice, or real electoral authority advisory.
   ```

---

## 4. Delivery Retry Strategy & Exponential Backoff

All asynchronous delivery attempts are tracked in the `notification_deliveries` table:
- **States**: `PENDING` -> `PROCESSING` -> `SENT` / `DELIVERED` / `FAILED`
- **Exponential Backoff**:
  When a delivery attempt fails (e.g., SMTP timeout), the next retry timestamp is calculated as:
  $$\text{nextRetryAt} = \text{now} + 2^{\text{attempts}} \times 60 \text{ seconds}$$
  - Attempt 1 failure: retry in 2 minutes ($2^1 \times 1\text{m}$)
  - Attempt 2 failure: retry in 4 minutes ($2^2 \times 1\text{m}$)
  - Attempt 3 failure: marked permanently as `FAILED` (dead-lettered)
- **Manual Administrative Retry**: Authorized administrators (`NOTIFICATIONS_RETRY` permission) can reset failed deliveries via `POST /api/v1/admin/notifications/deliveries/:id/retry`.
