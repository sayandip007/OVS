# OVS Observability, Metrics, Logging & Alerting

## 1. Zero-Dependency Prometheus Metrics Exposition

OVS includes a native Prometheus exposition engine implemented in `backend/src/modules/observability/metrics.ts`. It requires zero external dependencies, minimizing attack surface and dependency bloat.

### Scrape Endpoints
- Standard Prometheus Scraper: `GET /metrics`
- API-Namespaced Monitor: `GET /api/v1/metrics`
- Format: `text/plain; version=0.0.4; charset=utf-8`

### Route Sanitization (High Cardinality Prevention)
To prevent metric label cardinality explosion, all dynamic URL paths are sanitized by `sanitizeRoutePath()` before recording:
- UUIDs -> `/:id`
- Numeric IDs -> `/:id`
- State constituencies (e.g. `WB-KOL-01`) -> `/:constituencyId`
- Election IDs -> `/:electionId`
- Query strings are stripped entirely.

### Metric Catalog

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `ovs_http_requests_total` | Counter | Total HTTP requests categorized by `method`, `status`, and sanitized `route`. |
| `ovs_http_request_duration_seconds` | Histogram | Request latency distribution across 11 buckets (`0.005s` to `10s`). |
| `process_cpu_seconds_total` | Counter | Combined user and system CPU time consumed by the Node.js process. |
| `process_cpu_user_seconds_total` | Counter | Total user CPU time in seconds. |
| `process_cpu_system_seconds_total`| Counter | Total system CPU time in seconds. |
| `process_resident_memory_bytes` | Gauge | Resident set size (RSS) memory consumption in bytes. |
| `nodejs_heap_size_used_bytes` | Gauge | Process heap memory actively in use. |
| `nodejs_heap_size_total_bytes` | Gauge | Total heap memory allocated by V8. |
| `process_uptime_seconds` | Gauge | Seconds elapsed since Node.js process startup. |
| `ovs_build_info` | Gauge | Constant `1` labeled with application `version` and `node_env`. |
| `ovs_notification_outbox_pending_count` | Gauge | Backlog count of queued notification deliveries. |
| `ovs_notification_outbox_failed_count` | Gauge | Total failed notification deliveries. |
| `ovs_active_polling_elections_count` | Gauge | Current count of elections in active `POLLING_ACTIVE` state. |

### Privacy & Anonymity Guarantee
In strict adherence to OVS architectural principles:
- Metrics contain **zero** voter identification tokens, EPIC numbers, phone numbers, or IP addresses.
- Metrics contain **zero** candidate choices or vote selections.

---

## 2. Structured Logging with Pino

Backend HTTP logs and application diagnostic events are structured with Pino:
- Each log entry includes `req_id` (from `X-Request-Id` header or generated UUIDv4).
- Automatic redaction of sensitive headers (`authorization`, `cookie`, `set-cookie`).
- Configurable log levels via `LOG_LEVEL` (`debug`, `info`, `warn`, `error`).

---

## 3. Recommended Prometheus Alert Definitions

```yaml
groups:
  - name: ovs_production_alerts
    rules:
      - alert: HighErrorRate5xx
        expr: sum(rate(ovs_http_requests_total{status=~"5.."}[5m])) / sum(rate(ovs_http_requests_total[5m])) > 0.02
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "OVS API 5xx error rate exceeds 2% over 5 minutes"

      - alert: HighLatencyP95
        expr: histogram_quantile(0.95, sum(rate(ovs_http_request_duration_seconds_bucket[5m])) by (le)) > 0.5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "OVS API p95 latency exceeds 500ms over 3 minutes"

      - alert: NotificationQueueBacklogSpike
        expr: ovs_notification_outbox_pending_count > 500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Notification queue backlog exceeds 500 pending messages"

      - alert: HighMemoryConsumption
        expr: process_resident_memory_bytes > 800000000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Node.js process RSS memory exceeds 800MB"
```
