# Maintenance Mode Engine & Availability Architecture

## 1. Overview
The OVS Maintenance Mode Engine provides controlled state transitions to preserve data integrity during upgrades, migrations, or emergency incident responses. The engine implements RFC 9457 Problem Details for all 503 responses and provides deterministic recovery mechanisms for system administrators.

---

## 2. Maintenance States

The platform supports four explicit operational states:

1. **`NORMAL`**: Full platform availability for all voters, visitors, and administrators.
2. **`SCHEDULED_MAINTENANCE`**: The platform remains fully operational, but responses carry informational headers (`X-Maintenance-Scheduled`, `X-Maintenance-Start`, `X-Maintenance-End`). The frontend displays a non-blocking informational countdown banner.
3. **`MAINTENANCE_ACTIVE`**: The system is offline for operational maintenance. All public and voter API requests receive HTTP 503 Service Unavailable with a `Retry-After` header.
4. **`READ_ONLY_MODE`**: Read requests (`GET`, `HEAD`, `OPTIONS`) remain available. All mutating operations (`POST`, `PUT`, `PATCH`, `DELETE`) from non-super-administrators are intercepted with an HTTP 503 read-only error.

---

## 3. Allowlist & Admin Recovery Guarantee

To prevent administrative lockout during active maintenance, the middleware strictly preserves the following allowlist routes:

| Route / Prefix | Purpose | Allowed Callers |
| :--- | :--- | :--- |
| `/api/v1/health/*` | Liveness and readiness probes | Orchestration & Monitoring Probes |
| `/api/v1/system/public-config` | Public metadata and maintenance banner status | Public Frontend & Clients |
| `/api/v1/admin/auth/login` | Administrator session creation | Super & National Administrators |
| `/api/v1/admin/auth/session` | Administrator session verification | Authenticated Administrators |
| `/api/v1/admin/system/maintenance` | Maintenance state management & deactivation | `SUPER_ADMIN` |

Furthermore, any request bearing a valid session authenticated as `SUPER_ADMIN` or `NATIONAL_ADMIN` bypasses maintenance interception (`X-Maintenance-Mode-Bypass: admin-recovery`), allowing administrators to perform migrations, run validation scripts, and toggle maintenance mode back to `NORMAL`.

---

## 4. HTTP 503 RFC 9457 Payload Structure

When a request is intercepted under `MAINTENANCE_ACTIVE`, the server issues:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/problem+json
Retry-After: 300
```

```json
{
  "type": "https://ovs.eci.gov.in/errors/maintenance-active",
  "title": "Service Maintenance In Progress",
  "status": 503,
  "detail": "The voting system is undergoing scheduled maintenance. Please check back shortly.",
  "instance": "/api/v1/voters/ballot",
  "code": "MAINTENANCE_ACTIVE",
  "requestId": "req_01HPZ7K9...",
  "timestamp": "2026-11-14T14:15:00.000Z",
  "maintenance": {
    "state": "MAINTENANCE_ACTIVE",
    "startAt": "2026-11-14T14:00:00.000Z",
    "endAt": "2026-11-14T14:30:00.000Z",
    "isEmergency": false,
    "retryAfterSeconds": 300
  }
}
```
