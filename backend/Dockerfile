# ==============================================================================
# OVS Backend — Production Multi-Stage Node.js 22 Alpine Dockerfile
# ==============================================================================
# Stage 1: Base runtime environment with required system libraries
FROM node:22.12.0-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat wget

# Stage 2: Dependencies and Prisma client generation
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate --schema=prisma/schema.prisma

# Stage 3: TypeScript Build
FROM deps AS build
WORKDIR /app
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
RUN npm run build

# Stage 4: Prune devDependencies while keeping generated Prisma Client
FROM deps AS prod-deps
WORKDIR /app
RUN npm prune --omit=dev

# Stage 5: Production Runtime Runner
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy production package manifests and prisma schema
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma/

# Copy production dependencies (including pre-generated @prisma/client)
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

# Copy compiled JavaScript output
COPY --chown=node:node --from=build /app/dist ./dist

# Run as unprivileged non-root user
USER node

EXPOSE 5000

# Container Healthcheck targeting OVS health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

# Standard exec-form CMD for graceful SIGTERM handling by Node PID 1
CMD ["node", "dist/server.js"]
