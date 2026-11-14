# Operational Health & Diagnostics Specification

## 1. Overview
The OVS backend provides two tiers of health and diagnostic monitoring:

1. **Unauthenticated Public Probes (`/api/v1/health/live` & `/ready`)**:
   Designed for container orchestrators (e.g., Kubernetes, Docker Compose, systemd) and load balancers. They return minimal payloads indicating process liveness and baseline PostgreSQL ping latency (`SELECT 1 AS ok`).
2. **Authenticated Diagnostic Telemetry (`/api/v1/health/diagnostics`)**:
   Restricted to administrators holding the `DIAGNOSTICS_READ` permission (`SUPER_ADMIN`, `NATIONAL_ADMIN`, `READ_ONLY_AUDITOR`). Exposes rich operational telemetry while enforcing **zero secret leakage**.

---

## 2. Diagnostics Report Schema

```json
{
  "timestamp": "2026-11-14T14:15:30.000Z",
  "status": "HEALTHY",
  "service": "ovs-backend",
  "version": "1.0.0-phase-8.12",
  "environment": "production",
  "uptimeSeconds": 86420,
  "memory": {
    "heapUsedMb": 54.32,
    "heapTotalMb": 96.00,
    "rssMb": 112.50
  },
  "database": {
    "status": "UP",
    "latencyMs": 4,
    "pendingDeliveries": 0,
    "failedDeliveries": 0,
    "totalElections": 12,
    "activeElections": 2
  },
  "maintenance": {
    "state": "NORMAL",
    "isEmergency": false
  }
}
```

---

## 3. Strict Credential & Secret Protection Policy

Under no circumstances does the diagnostic endpoint reveal:
- Database host, port, username, or connection URI (`DATABASE_URL`).
- Application session secret or token signing keys (`SESSION_SECRET`).
- Third-party email API tokens or credentials.
- Voter or administrator PII, hashes, or passwords.

All database latency checks are run via parameterized queries, and overall service status is automatically degraded if database latency exceeds 500ms, failed deliveries exceed 50, or active maintenance is in progress.
