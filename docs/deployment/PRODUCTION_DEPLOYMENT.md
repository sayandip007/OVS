# OVS Production Deployment Architecture & Runbook

## 1. High-Level Topology

The Online Voting System (OVS) is deployed as a hardened, containerized multi-tier service:

```
                            [ Client Web Browser ]
                                      |
                                      v HTTPS (443) / HTTP (80)
                       +-------------------------------+
                       |        Edge Ingress /         |
                       |       frontend-proxy          |
                       |       (Nginx 1.27)            |
                       +---------------+---------------+
                                       |
                   +-------------------+-------------------+
                   | /assets/*         | /                 | /api/v1/*
                   v                   v                   v
         +-------------------+ +---------------+ +-------------------+
         | Static File Cache | | SPA Fallback  | | backend-api       |
         | (1y immutable)    | | (index.html)  | | (Node.js 22 LTS)  |
         +-------------------+ +---------------+ +---------+---------+
                                                           |
                                                           v TCP 5432 (Internal)
                                                 +-------------------+
                                                 | postgres-db       |
                                                 | (PostgreSQL 16)   |
                                                 | Named Volume      |
                                                 +-------------------+
```

### Key Architectural Boundaries
1. **Isolated Internal Network (`ovs_internal_net`):** The PostgreSQL database container does NOT publish port 5432 to the host network in production. Only `backend-api` can communicate with `postgres-db`.
2. **Reverse Proxy & Single Origin:** The frontend React SPA and the backend API are co-located under the same host origin via Nginx. Browser clients send requests to `/api/v1/*`, eliminating CORS complexity in production.
3. **Non-Root Execution:** All application containers execute as unprivileged system users (`USER node` in backend, unprivileged worker processes in Nginx).
4. **Graceful Connection Draining:** Backend servers intercept `SIGTERM` and `SIGINT`, close incoming HTTP sockets, drain existing transactions up to a strict 10-second timeout, disconnect Prisma pools cleanly, and terminate gracefully.

---

## 2. Docker Containers

### Backend Container (`backend/Dockerfile`)
- **Base Image:** `node:22.12.0-alpine` (pinned LTS).
- **Multi-Stage Structure:**
  - `base`: Installs required system libraries (`openssl`, `libc6-compat`, `wget`).
  - `deps`: Installs npm dependencies and generates Prisma Client.
  - `build`: Compiles TypeScript with `tsconfig.build.json`.
  - `runner`: Copies compiled JavaScript, runs `npm prune --omit=dev`, assigns non-root ownership (`node:node`), exposes port 5000, and configures container `HEALTHCHECK`.
- **Healthcheck:**
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1
  ```

### Frontend Container (`Dockerfile.frontend`)
- **Base Image:** `node:22.12.0-alpine` (build stage) -> `nginx:1.27-alpine` (runtime stage).
- **Build Args:**
  - `VITE_API_BASE_URL=/api/v1`
  - `VITE_DATA_SOURCE_MODE=LOCAL_DEMO`
- **Nginx Security Features:**
  - `server_tokens off` (removes server version disclosure).
  - Security headers: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`.
  - Gzip compression on JSON, JS, CSS, SVG.
  - `/nginx-health` endpoint for container orchestration probes.

---

## 3. Production Compose Deployment (`docker-compose.production.yml`)

### Step-by-Step Deployment Runbook

#### 1. Prepare Environment Secrets
Create a secure production environment file `.env.production` (never commit to version control):
```bash
POSTGRES_USER=ovs_prod_admin
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=ovs_production
SESSION_SECRET=$(openssl rand -base64 48)
CLIENT_ORIGIN=https://ovs.example.gov.in
LOG_LEVEL=info
OVS_HTTP_PORT=80
```

#### 2. Verify Compose Configuration
```bash
docker compose --env-file .env.production -f docker-compose.production.yml config
```

#### 3. Build & Launch the Stack
```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

#### 4. Run Schema Migrations
```bash
docker compose -f docker-compose.production.yml exec backend-api \
  npx prisma migrate deploy --schema=prisma/schema.prisma
```

#### 5. Verify Health Status
```bash
# Verify all three containers report "healthy"
docker compose -f docker-compose.production.yml ps

# Probe public health endpoint
curl -i http://localhost/api/v1/health
```

---

## 4. Zero-Downtime Migration Strategy: Expand-and-Contract

When releasing schema updates in production:
1. **Phase 1: Expand (Non-breaking additive changes)**
   - Add new nullable columns or tables.
   - Dual-write to both legacy and new structures if migrating data.
   - Deploy backend code that supports both old and new columns.
2. **Phase 2: Backfill**
   - Execute background backfill migrations during off-peak hours.
3. **Phase 3: Switch Reads**
   - Point application queries exclusively to the new columns.
4. **Phase 4: Contract (Cleanup)**
   - Drop deprecated columns/tables in a subsequent release after verifying stability.
