# OVS Docker & Local Development Architecture (Phase 8.1.2 Hardened)

## 1. Local Containerized Topology Overview

The OVS local development environment is designed to provide reproducible, isolated execution across backend, database, and frontend components using Docker Compose.

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│                             DOCKER COMPOSE TOPOLOGY                            │
│                                                                                │
│  ┌──────────────────────┐    ┌─────────────────────┐    ┌───────────────────┐  │
│  │   frontend-dev       │    │    backend-api      │    │    postgres-db    │  │
│  │   Vite + React 19    │───▶│   Node 22 + Express │───▶│   PostgreSQL 16   │  │
│  │   Port: 3000         │    │   Port: 5000        │    │   Port: 5432      │  │
│  └──────────────────────┘    └─────────────────────┘    └─────────┬─────────┘  │
│                                         │                         │            │
│                                         ▼                         ▼            │
│                              ┌─────────────────────┐    ┌───────────────────┐  │
│                              │  redis-cache (Opt)  │    │ pgdata volume     │  │
│                              │  Redis 7-Alpine     │    │ Persistent Disk   │  │
│                              │  Port: 6379         │    └───────────────────┘  │
│                              └─────────────────────┘                           │
└────────────────────────────────────────────────────────────────────────────────┘
```

> **SCOPE REMINDER**: This file is an architectural blueprint. Docker containers will be created and launched in subsequent implementation phases, not in Phase 8.1.1.

---

## 2. Docker Compose Specification (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  postgres-db:
    image: postgres:16-alpine
    container_name: ovs-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-ovs_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-ovs_secret_dev}
      POSTGRES_DB: ${POSTGRES_DB:-ovs_db}
    ports:
      - "5432:5432"
    volumes:
      - ovs_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis-cache:
    image: redis:7-alpine
    container_name: ovs-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend-api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ovs-backend
    restart: unless-stopped
    environment:
      NODE_ENV: development
      PORT: 5000
      DATABASE_URL: postgresql://${POSTGRES_USER:-ovs_admin}:${POSTGRES_PASSWORD:-ovs_secret_dev}@postgres-db:5432/${POSTGRES_DB:-ovs_db}?schema=public
      REDIS_URL: redis://redis-cache:6379
      SESSION_SECRET: ${SESSION_SECRET:-dev_session_secret_32_characters_long_min}
      CLIENT_ORIGIN: http://localhost:3000
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      postgres-db:
        condition: service_healthy
      redis-cache:
        condition: service_healthy
    command: npm run dev

  frontend-dev:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: ovs-frontend
    restart: unless-stopped
    environment:
      VITE_PORT: 3000
      VITE_DATA_SOURCE_MODE: BACKEND_API
      VITE_API_BASE_URL: http://localhost:5000/api/v1
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - backend-api
    command: npm run dev -- --host 0.0.0.0 --port 3000

volumes:
  ovs_pgdata:
    driver: local
```

---

## 3. Environment Variables Specification (`.env.example`)

```dotenv
# ==============================================================================
# OVS Environment Configuration Template (Placeholders only — No production secrets)
# ==============================================================================

# Node Environment
NODE_ENV=development
PORT=5000

# PostgreSQL Connection
POSTGRES_USER=ovs_admin
POSTGRES_PASSWORD=ovs_secret_dev
POSTGRES_DB=ovs_db
DATABASE_URL="postgresql://ovs_admin:ovs_secret_dev@localhost:5432/ovs_db?schema=public"

# Redis Cache (Optional)
REDIS_URL="redis://localhost:6379"

# Security & Sessions
SESSION_SECRET="replace_with_a_cryptographically_secure_random_string_32_chars"
COOKIE_DOMAIN="localhost"

# Frontend Integration
CLIENT_ORIGIN="http://localhost:3000"
VITE_DATA_SOURCE_MODE="BACKEND_API"
VITE_API_BASE_URL="http://localhost:5000/api/v1"
```

---

## 4. Local Developer Workflow

```bash
# 1. Clone repository and set up environment
cp .env.example .env

# 2. Start PostgreSQL and Redis backing services
docker compose up -d postgres-db redis-cache

# 3. Apply Prisma migrations and custom SQL integrity constraints
cd backend
npx prisma migrate dev --name init
psql $DATABASE_URL -f ../docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql
npx prisma db seed

# 4. Start backend API service
npm run dev

# 5. Start frontend development server in dual mode
cd ..
npm run dev
```
