# OVS Technical Troubleshooting Runbook

**Audience:** Site Reliability Engineers, DevOps, System Administrators  

---

## 1. Common Diagnostics & Solutions

### Issue 1: Database Connection Refused (`Can't reach database server at localhost:5432`)
- **Root Cause:** PostgreSQL daemon is not running or port 5432 is blocked.
- **Verification:** `pg_isready -h localhost -p 5432`
- **Solution:**
  - Start local PostgreSQL: `systemctl start postgresql` or start Docker container: `docker compose up -d postgres-db`.
  - Check `DATABASE_URL` in `backend/.env`.

### Issue 2: Session Cookie / CSRF Rejection (HTTP 403 Forbidden)
- **Root Cause:** Missing or invalid `x-csrf-token` header, or cross-origin mismatch between `CLIENT_ORIGIN` and request origin.
- **Solution:**
  - Ensure `CLIENT_ORIGIN=http://localhost:3000` is set in `backend/.env`.
  - Check browser DevTools -> Application -> Cookies to ensure `ovs_session` is present and marked `HttpOnly; SameSite=Strict`.

### Issue 3: Schema / Trigger Mismatch After Database Reset
- **Root Cause:** Migrations were not applied after resetting the database.
- **Solution:**
  - Re-deploy all migrations: `npm run prisma:migrate:deploy`. This applies all DDL tables and custom PL/pgSQL database triggers in a single atomic pipeline.

### Issue 4: EPERM on Windows Node.js Directory Operations
- **Root Cause:** Transient Windows file-locking by antivirus or file indexer during fast successive writes in `.temp` or `dist`.
- **Solution:**
  - Re-run the build or test command; the tool will succeed on second execution.

### Issue 5: Port Conflict (Port 5000 or 3000 in use)
- **Solution:**
  - Find process on Windows: `Get-NetTCPConnection -LocalPort 5000` -> `Stop-Process -Id <PID>`.
  - On Linux/macOS: `lsof -i :5000` -> `kill -9 <PID>`.

---

## 2. Emergency Health & Observability Probes

```bash
# Check basic liveness
curl -i http://localhost:5000/api/v1/health/live

# Check database readiness
curl -i http://localhost:5000/api/v1/health/ready

# Scrape Prometheus metrics
curl -s http://localhost:5000/metrics | grep ovs_http_requests_total
```
