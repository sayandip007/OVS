# OVS Local Developer Setup Guide

**Target Environment:** Local Workstation (Linux, macOS, Windows with PowerShell)  
**Required Runtimes:** Node.js 22 LTS or newer, PostgreSQL 16 (optional for Docker mode)  

---

## 1. Prerequisites & Version Requirements

- **Node.js:** `>= 20.18.0` (Recommended: `v22.x LTS` or `v23.x`)
- **npm:** `>= 10.x`
- **PostgreSQL:** `>= 16.0` (required when running in `BACKEND_API` mode locally)
- **Docker & Docker Compose:** Required for containerized execution

---

## 2. Environment Variables Setup

Copy example environment configurations for both root/frontend and backend:

```bash
# Frontend / Root environment
cp .env.example .env

# Backend environment
cp backend/.env.example backend/.env
```

### Key Frontend Variables (`.env`)
```ini
# Choose data source mode: LOCAL_DEMO (browser localStorage) or BACKEND_API (live server)
VITE_DATA_SOURCE_MODE=BACKEND_API
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### Key Backend Variables (`backend/.env`)
```ini
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ovs_development?schema=public
SESSION_SECRET=local-development-session-secret-min-32-chars-long
OTP_HMAC_SECRET=local-development-otp-secret-min-32-chars-long
CSRF_SECRET=local-development-csrf-secret-min-32-chars-long
FRONTEND_ORIGIN=http://localhost:3000
```

---

## 3. Dependency Installation

```bash
# Install root & frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..
```

---

## 4. Database Setup, Migrations & Seeds

With PostgreSQL 16 running on `localhost:5432`:

```bash
# Generate Prisma Client
npx prisma generate --schema=backend/prisma/schema.prisma

# Run migrations against clean database
npx prisma migrate deploy --schema=backend/prisma/schema.prisma

# Apply native database integrity triggers
psql -d ovs_development -f backend/prisma/CUSTOM_DATABASE_INTEGRITY.sql

# Seed comprehensive demo dataset
npx tsx backend/prisma/seed-demo.ts
```

---

## 5. Starting the Development Servers

Open two terminal sessions:

### Terminal 1: Backend API Server
```bash
npm run backend:dev
# Server starts on http://localhost:5000
# Health check: http://localhost:5000/health
# Prometheus metrics: http://localhost:5000/metrics
```

### Terminal 2: Frontend Vite Server
```bash
npm run dev
# Frontend starts on http://localhost:3000
```

---

## 6. Docker Production-Like Local Startup

To run the complete containerized stack:

```bash
# Build and run Postgres, Backend, and Frontend containers
docker compose -f docker-compose.yml up --build -d

# Verify services status
docker compose ps

# View logs
docker compose logs -f backend
```

---

## 7. Running Verification Tests

```bash
# Run unit & system integration suites
npm run backend:test:unit

# Run architecture consistency & invariant suite
npm test

# Run frontend & backend typecheck
npm run typecheck
npm run backend:typecheck

# Build production bundle
npm run build
```
