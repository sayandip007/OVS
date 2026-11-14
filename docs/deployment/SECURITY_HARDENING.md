# OVS Production Security Hardening Specification

This document details the multi-layered defense-in-depth security architecture implemented across the Online Voting System (OVS) platform.

---

## 1. Container & Process Security

### Non-Root Execution
- **Backend:** Executes under the unprivileged standard Node user (`USER node`, UID 1000). The container has no `sudo` binary and cannot escalate privileges.
- **Frontend / Nginx:** Runs unprivileged worker processes; root directory is read-only at runtime except for `/tmp` and `/var/log/nginx`.

### Pinned Images & Minimized Attack Surface
- Base images are strictly pinned to verified LTS versions: `node:22.12.0-alpine` and `nginx:1.27-alpine`.
- Build-time tools (compilers, build devDependencies) are stripped via multi-stage builds (`npm prune --omit=dev`), reducing image size and eliminating exploitable build dependencies from the runtime image.

### Health Probes & Failure Isolation
- Docker containers run isolated container health checks (`HEALTHCHECK`) using internal probes (`wget -q --spider`). Unhealthy containers are quarantined by the orchestrator and prevented from receiving ingress traffic.

---

## 2. Network Security & Perimeter Hardening

### Internal Network Boundary (`ovs_internal_net`)
- All database communications occur over an internal bridge network.
- The PostgreSQL port (5432) is **not published** to the host interface in production compose configurations. Only containers attached to `ovs_internal_net` can resolve `postgres-db:5432`.

### Reverse Proxy & Origin Hardening
- Nginx acts as the single edge point of contact for external traffic.
- Requests to `/api/` are forwarded with sanitized headers:
  - `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Request-Id`.
- Direct access to internal Express backend port (5000) from the internet is prohibited.

### Hardened HTTP Security Headers
Nginx and Helmet middleware enforce:
- `X-Content-Type-Options: nosniff` (prevents MIME type sniffing).
- `X-Frame-Options: DENY` (clickjacking mitigation).
- `X-XSS-Protection: 1; mode=block`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`.

---

## 3. Application Security & Cryptography

### Session Security & Anti-Fixation
- Sessions use cryptographic tokens signed with HMAC-SHA256.
- Cookies are marked `HttpOnly`, `SameSite=Strict`, and `Secure` (in production).
- Session IDs are regenerated upon authentication to neutralize session fixation attacks.

### Secret Management & Redaction
- Zod schema validation strictly rejects known development placeholder secrets in `staging` and `production`.
- Pino HTTP logger automatically redacts `authorization`, `cookie`, and `set-cookie` headers.
- All database audit logs recursively sanitize password, token, OTP, and secret keys before database persistence.

### Rate Limiting & Anti-Brute-Force
- Express API endpoints are protected by `express-rate-limit` (default: 120 req/min/IP).
- Authentication and OTP verification endpoints enforce strict per-IP and per-EPIC attempt limits and progressive lockouts.

---

## 4. Fundamental Privacy & Anonymity Invariant

The core security principle of OVS is voter anonymity:
- **Zero Candidate Choice Storage:** The backend database schema contains **no** column, table, or relation linking a voter to a candidate choice or vote selection.
- **Participation Only:** The system records solely whether a voter participated (`DemoParticipation`), never what they chose.
- **Independent Counting:** All vote tallies and results are synthetic simulations managed independently from participation records.
