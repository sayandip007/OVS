# ==============================================================================
# OVS Backend Foundation — Multi-Stage Node.js 22 Alpine Dockerfile
# ==============================================================================
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package.json ./
COPY prisma ./prisma/
RUN npm install && npx prisma generate --schema=prisma/schema.prisma

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma/

EXPOSE 5000
CMD ["node", "dist/server.js"]
