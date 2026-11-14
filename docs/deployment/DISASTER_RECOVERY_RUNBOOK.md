# OVS Comprehensive Disaster Recovery Runbook

This runbook provides incident responders and DevOps engineers with standardized, step-by-step operational recovery procedures for 10 catastrophic failure scenarios.

---

## Disaster Recovery Objectives
- **Target RTO (Recovery Time Objective):** < 30 minutes
- **Target RPO (Recovery Point Objective):** < 15 minutes
- **Verification Rule:** All recovered services must pass automated health and smoke tests prior to reopening to user traffic.

---

## Scenario Index

| Scenario ID | Incident Description | Target RTO | Target RPO |
| :--- | :--- | :--- | :--- |
| **DR-01** | Complete Database Host / Container Loss | 25 min | 15 min |
| **DR-02** | Corrupted or Failed Schema Migration | 10 min | 0 min |
| **DR-03** | Accidental Administrative Data Deletion | 20 min | 15 min |
| **DR-04** | Compromised Secret Key (`SESSION_SECRET`) | 5 min | 0 min |
| **DR-05** | Distributed Denial of Service (DDoS) / Traffic Surge | 5 min | 0 min |
| **DR-06** | Backend API Container Crash Loop | 10 min | 0 min |
| **DR-07** | Edge Reverse Proxy / Nginx Failure | 5 min | 0 min |
| **DR-08** | Storage Volume Corruption / Unavailability | 30 min | 15 min |
| **DR-09** | Audit Trail Data Tampering / Integrity Check Failure | 15 min | 0 min |
| **DR-10** | Stale Cache / Split-Brain Inconsistency | 5 min | 0 min |

---

## DR-01: Complete Database Host / Container Loss

### 1. Containment & Assessment
1. Check if database volume or container is dead:
   ```bash
   docker compose -f docker-compose.production.yml ps postgres-db
   ```
2. Enable emergency maintenance mode via public reverse proxy if frontend is still reachable:
   ```bash
   # Switch Nginx to return static maintenance page
   docker compose -f docker-compose.production.yml exec frontend-proxy \
     sed -i 's/return 200/return 503/g' /etc/nginx/nginx.conf && nginx -s reload
   ```

### 2. Restoration Procedure
1. Identify the latest verified backup archive from `backups/` and check its SHA-256 hash:
   ```bash
   sha256sum -c backups/ovs_ovs_production_<LATEST>.dump.sha256
   ```
2. Re-create the PostgreSQL container with fresh persistent storage:
   ```bash
   docker compose -f docker-compose.production.yml down postgres-db
   docker volume rm ovs_prod_pgdata
   docker compose -f docker-compose.production.yml up -d postgres-db
   ```
3. Wait for PostgreSQL container health check to turn green (`pg_isready`).
4. Restore verified dump into `ovs_production`:
   ```bash
   docker exec -i ovs-prod-postgres pg_restore -U ovs_prod_user -d ovs_production --no-owner < backups/ovs_ovs_production_<LATEST>.dump
   ```

### 3. Verification & Reopen
1. Query key tables (`_prisma_migrations`, `elections`, `system_settings`).
2. Restart `backend-api` to reconnect cleanly.
3. Verify `/api/v1/health` reports status `UP` with database latency `< 50ms`.
4. Restore standard Nginx configuration and reopen traffic.

---

## DR-02: Corrupted or Failed Schema Migration

### 1. Containment
1. Freeze deployment pipeline; do not restart backend containers.
2. Inspect migration error log:
   ```bash
   npx prisma migrate status --schema=backend/prisma/schema.prisma
   ```

### 2. Recovery Procedure
1. Mark the failed migration as rolled back in the Prisma migrations table:
   ```bash
   npx prisma migrate resolve --rolled-back "<FAILED_MIGRATION_NAME>"
   ```
2. If down migration SQL exists, apply corrective SQL statements:
   ```bash
   psql "$DATABASE_URL" -f migrations/<TIMESTAMP>_rollback.sql
   ```
3. If database is in an inconsistent state, execute non-destructive restore from the pre-migration snapshot taken immediately prior to the deployment.

---

## DR-03: Accidental Administrative Data Deletion

### 1. Assessment
1. Determine impacted table (e.g. `elections`, `candidate_nominations`).
2. Do NOT overwrite the production database.

### 2. Selective Recovery Procedure
1. Execute non-destructive restore into the verification sandbox database:
   ```bash
   ./scripts/backup/restore-verify.sh backups/ovs_ovs_production_<PRE_INCIDENT>.dump
   ```
2. Extract only the missing records from the sandbox database using `pg_dump`:
   ```bash
   pg_dump -h localhost -U ovs_admin -d ovs_restore_verification_sandbox \
     -t elections --data-only > /tmp/restored_elections.sql
   ```
3. Review `/tmp/restored_elections.sql` and import into production with transaction safety:
   ```bash
   psql -h localhost -U ovs_prod_user -d ovs_production -v ON_ERROR_STOP=1 -f /tmp/restored_elections.sql
   ```
4. Tear down the sandbox database.

---

## DR-04: Compromised Secret Key (`SESSION_SECRET`)

### 1. Containment & Remediation
1. Generate a new high-entropy 64-character secret key:
   ```bash
   NEW_SECRET=$(openssl rand -base64 48)
   ```
2. Update `.env.production` with `SESSION_SECRET=$NEW_SECRET`.
3. Perform a zero-downtime rolling restart of backend containers:
   ```bash
   docker compose -f docker-compose.production.yml up -d --no-deps backend-api
   ```
4. **Impact:** All active voter and admin sessions are immediately invalidated (force-logged out). Users must re-authenticate with credentials/OTP. All forged cookies are instantly rejected by HMAC signature mismatch.

---

## DR-05: Denial of Service (DoS) / Traffic Surge

### 1. Immediate Mitigation
1. Adjust rate limiting threshold in `.env.production`:
   ```bash
   RATE_LIMIT_MAX=30
   docker compose -f docker-compose.production.yml up -d --no-deps backend-api
   ```
2. Enable aggressive Nginx connection and request limiting at the edge reverse proxy:
   ```nginx
   limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
   limit_req zone=api_limit burst=20 nodelay;
   ```
3. Inspect `ovs_http_requests_total` metric to identify malicious IPs or endpoints.

---

## DR-06: Backend API Container Crash Loop

### 1. Diagnosis
```bash
docker compose -f docker-compose.production.yml logs --tail=100 backend-api
```
### 2. Common Causes & Fixes
- **Unreachable DB:** Verify PostgreSQL health check and internal network connectivity (`ping postgres-db` from container).
- **Invalid Environment Variable:** Check Zod validation error messages in the crash log.
- **Port Conflict:** Verify port 5000 is not blocked by external processes.

---

## DR-07: Edge Reverse Proxy / Nginx Failure

### 1. Diagnosis & Recovery
```bash
docker compose -f docker-compose.production.yml logs frontend-proxy
docker compose -f docker-compose.production.yml restart frontend-proxy
```
If configuration is corrupted, revert `docker/nginx/nginx.conf` from git and reload: `docker exec ovs-prod-frontend nginx -t && nginx -s reload`.

---

## DR-08: Storage Volume Corruption / Unavailability

1. Unmount damaged volume.
2. Provision new local named volume or EBS/Persistent Disk.
3. Re-initialize container and run `scripts/backup/restore-verify.sh` to populate data from S3/backup repository.

---

## DR-09: Audit Trail Tampering / Integrity Failure

1. Place application into emergency maintenance mode (`MAINTENANCE_LOCKED`).
2. Query `audit_logs` table and export existing sequence to an immutable forensics storage.
3. Cross-reference database rows against independent Pino JSON application log streams.

---

## DR-10: Stale Cache / Split-Brain Inconsistency

1. Flush local cache or in-memory caches by restarting backend services with zero downtime.
2. Invalidate public config and feature flag cache via `/api/v1/admin/system/settings/reload`.
