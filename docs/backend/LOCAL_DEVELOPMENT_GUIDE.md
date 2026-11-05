# OVS Local Development & Docker Guide (`docs/backend/LOCAL_DEVELOPMENT_GUIDE.md`)

## 1. Development Modes

The Online Voting System (OVS) supports two runtime data-source modes controlled via `VITE_DATA_SOURCE_MODE`:

1. **`LOCAL_DEMO` (Default)**:
   - The React 19 frontend on port `3000` uses its client-side `localStorage` persistence and curated demonstration datasets.
   - Zero backend server dependency is required to run or test existing Phases 1–7.7 frontend workflows.
2. **`BACKEND_API` (Foundation Ready)**:
   - Configures `src/services/apiClient.js` to communicate with the Express 5 + PostgreSQL 16 backend at `VITE_API_BASE_URL` (`http://localhost:5000/api/v1`).

---

## 2. Running Locally Without Docker

### Prerequisites
- Node.js 22+
- PostgreSQL 15/16 running on `localhost:5432`

### Step-by-Step Commands

```bash
# 1. Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env

# 2. Install root (frontend) and backend dependencies
npm install
npm --prefix backend install

# 3. Generate Prisma Client, deploy migrations, and seed DEMO_SAMPLE data
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run prisma:seed

# 4. Start the Backend API Server (Port 5000)
npm --prefix backend run dev

# 5. Start the React Frontend Dev Server (Port 3000)
npm run dev
```

---

## 3. Running with Docker Compose

The root `docker-compose.yml` defines three services:
- `postgres-db`: PostgreSQL 16 (`postgres:16-alpine`) on port `5432` with healthcheck and persistent volume `ovs_pgdata`.
- `backend-api`: Node.js 22 + Express 5 + Prisma 6 on port `5000` (automatically runs `prisma migrate deploy` and `prisma:seed` on startup).
- `frontend-dev`: Vite + React 19 development server on port `3000`.

```bash
# Start all services in the background
docker compose up -d --build

# Check service health
curl http://localhost:5000/api/v1/health/live
curl http://localhost:5000/api/v1/health/ready

# View logs
docker compose logs -f backend-api

# Stop services
docker compose down
```

---

## 4. Running the Verification Suites

```bash
# Frontend unit & architecture consistency tests (92 tests)
npm test

# Backend unit tests (Foundation, Auth, Voters — 43 tests)
npm run backend:test:unit

# Backend Supertest + live PostgreSQL integration tests (including Phase 8.3 suite)
npm run backend:test:integration

# Full 31-scenario PostgreSQL trigger & constraint validation suite
psql "postgresql://ovs_admin:ovs_secret_dev@localhost:5432/ovs_db" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql
```

---

## 5. Development OTP Inspection & Authentication Testing

In development and test environments (`NODE_ENV !== 'production'`), generated OTP codes are stored in-memory by `DevelopmentOtpProvider` and can be inspected via:

```bash
# Request OTP for registered voter:
curl -X POST http://localhost:5000/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"identifier":"9876500001"}'

# Inspect generated code (Development only):
curl http://localhost:5000/api/v1/auth/dev/latest-otp?identifier=9876500001
# Returns: { "success": true, "data": { "identifier": "9876500001", "otp": "123456" } }

# Verify OTP and receive HttpOnly session cookie:
curl -i -X POST http://localhost:5000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"<uuid>","otp":"123456"}'
```
